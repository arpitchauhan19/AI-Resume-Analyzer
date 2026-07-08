const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const env = require("../config/env");
const ApiError = require("../middleware/ApiError");

/** Delays before each cold-start /parse retry (ms). Render free tier boots in ~50–60s. */
const COLD_START_PARSE_DELAYS_MS = [65000, 50000, 50000];

/** Max /parse attempts when Render returns transient cold-start errors. */
const MAX_PARSE_ATTEMPTS = COLD_START_PARSE_DELAYS_MS.length + 1;

/** Timeout for parser liveness probes (shorter than parse; triggers wake-up). */
const PARSER_HEALTH_TIMEOUT_MS = 15000;

/** Extra headroom for the retry parse after wake-up (spaCy model load). */
const PARSER_COLD_PARSE_TIMEOUT_MS = 90000;

const parserClient = axios.create({
  baseURL: env.parserServiceUrl,
  maxContentLength: Infinity,
  maxBodyLength: Infinity,
});

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Builds a multipart body for `POST /parse`.
 *
 * @param {Express.Multer.File} file
 * @returns {FormData}
 */
function buildParseForm(file) {
  const form = new FormData();
  form.append("file", fs.createReadStream(file.path), {
    filename: file.originalname,
    contentType: file.mimetype,
  });
  return form;
}

/**
 * Coerces a response body to plain text for inspection.
 *
 * @param {unknown} data
 * @returns {string}
 */
function toHealthBodyText(data) {
  if (data === undefined || data === null) return "";
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

/**
 * @param {string} bodyText
 * @param {number} [maxLen=100]
 * @returns {string}
 */
function healthBodyPreview(bodyText, maxLen = 100) {
  if (!bodyText) return "(empty)";
  const oneLine = bodyText.replace(/\s+/g, " ").trim();
  return oneLine.length <= maxLen ? oneLine : `${oneLine.slice(0, maxLen)}…`;
}

/**
 * Returns true when Render (or another proxy) serves a temporary HTML boot page.
 *
 * @param {string} contentType
 * @param {string} bodyText
 * @returns {boolean}
 */
function isRenderBootPage(contentType, bodyText) {
  const normalizedType = contentType.toLowerCase();
  if (normalizedType.includes("text/html")) return true;

  const trimmed = bodyText.trimStart().toLowerCase();
  return trimmed.startsWith("<!doctype html") || trimmed.startsWith("<html");
}

/**
 * HTTP statuses that indicate the parser is not ready yet (keep polling).
 *
 * @param {number} httpStatus
 * @returns {boolean}
 */
function isTransientHealthStatus(httpStatus) {
  return httpStatus === 429 || httpStatus === 502 || httpStatus === 503 || httpStatus === 504;
}

/**
 * Parses the parser health JSON body and reports whether JSON decoding succeeded.
 *
 * @param {unknown} data
 * @returns {{ body: { status?: string, message?: string } | null, jsonParseSucceeded: boolean }}
 */
function parseHealthBody(data) {
  if (data && typeof data === "object" && !Buffer.isBuffer(data) && !Array.isArray(data)) {
    return { body: data, jsonParseSucceeded: true };
  }

  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed) return { body: null, jsonParseSucceeded: false };

    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return { body: parsed, jsonParseSucceeded: true };
      }
      return { body: null, jsonParseSucceeded: false };
    } catch {
      return { body: null, jsonParseSucceeded: false };
    }
  }

  return { body: null, jsonParseSucceeded: false };
}

/**
 * Pings the parser `GET /health` endpoint. Never throws — callers use this for
 * orchestrator health checks and cold-start warm-up without failing the API.
 *
 * @returns {Promise<{ status: "healthy" | "unavailable", message?: string }>}
 */
async function checkParserHealth() {
  const healthUrl = `${env.parserServiceUrl}/health`;
  const method = "GET";

  console.info("[parser][health] Request: method=%s url=%s", method, healthUrl);

  try {
    const response = await axios.request({
      method,
      url: healthUrl,
      timeout: PARSER_HEALTH_TIMEOUT_MS,
      headers: { Accept: "application/json" },
      // Resolve every HTTP status here so status/body are always logged.
      validateStatus: () => true,
    });

    const httpStatus = response.status;
    const rawBody = response.data;
    const contentType = String(
      response.headers["content-type"] || response.headers["Content-Type"] || ""
    );
    const bodyText = toHealthBodyText(rawBody);
    const { body, jsonParseSucceeded } = parseHealthBody(rawBody);
    const bodyStatus = body?.status;
    const renderBootPage = isRenderBootPage(contentType, bodyText);

    console.info(
      "[parser][health] Response: method=%s url=%s httpStatus=%s contentType=%s bodyPreview=%s jsonParseSucceeded=%s parsedStatus=%s",
      method,
      healthUrl,
      httpStatus,
      contentType || "(missing)",
      healthBodyPreview(bodyText),
      jsonParseSucceeded,
      bodyStatus ?? "(missing)"
    );

    if (
      httpStatus >= 200 &&
      httpStatus < 300 &&
      jsonParseSucceeded &&
      bodyStatus === "healthy"
    ) {
      return { status: "healthy" };
    }

    if (renderBootPage) {
      console.info(
        "[parser][health] Booting: Render HTML loading page detected; continuing poll."
      );
      return {
        status: "unavailable",
        message: "Parser service is still booting.",
      };
    }

    if (isTransientHealthStatus(httpStatus)) {
      const label =
        httpStatus === 429
          ? "Rate limited (HTTP 429)"
          : `Upstream unavailable (HTTP ${httpStatus})`;
      console.info("[parser][health] Booting: %s; continuing poll.", label);
      return {
        status: "unavailable",
        message:
          httpStatus === 429
            ? "Parser service is still booting (rate limited)."
            : "Parser service is still waking up.",
      };
    }

    let message;
    if (httpStatus >= 200 && httpStatus < 300) {
      message =
        body?.message ||
        `Unexpected health payload (expected JSON status "healthy", got ${JSON.stringify(bodyStatus)}).`;
    } else {
      message =
        body?.message ||
        body?.error ||
        `Parser health check returned HTTP ${httpStatus}.`;
    }

    console.warn("[parser][health] Unavailable: %s", message);

    return { status: "unavailable", message };
  } catch (err) {
    const httpStatus = err.response?.status ?? "—";
    const rawBody = err.response?.data;
    const contentType = String(
      err.response?.headers?.["content-type"] ||
        err.response?.headers?.["Content-Type"] ||
        ""
    );
    const bodyText = toHealthBodyText(rawBody);
    const { jsonParseSucceeded } = parseHealthBody(rawBody);
    const axiosCode = err.code ?? "—";
    const axiosMessage = err.message ?? "unknown error";

    console.warn(
      "[parser][health] Error: method=%s url=%s httpStatus=%s contentType=%s bodyPreview=%s jsonParseSucceeded=%s axiosCode=%s axiosMessage=%s",
      method,
      healthUrl,
      httpStatus,
      contentType || "(missing)",
      healthBodyPreview(bodyText),
      jsonParseSucceeded,
      axiosCode,
      axiosMessage
    );

    if (isRenderBootPage(contentType, bodyText)) {
      console.info(
        "[parser][health] Booting: Render HTML loading page detected; continuing poll."
      );
      return {
        status: "unavailable",
        message: "Parser service is still booting.",
      };
    }

    if (typeof httpStatus === "number" && isTransientHealthStatus(httpStatus)) {
      const label =
        httpStatus === 429
          ? "Rate limited (HTTP 429)"
          : `Upstream unavailable (HTTP ${httpStatus})`;
      console.info("[parser][health] Booting: %s; continuing poll.", label);
      return {
        status: "unavailable",
        message:
          httpStatus === 429
            ? "Parser service is still booting (rate limited)."
            : "Parser service is still waking up.",
      };
    }

    const message =
      axiosCode === "ECONNABORTED"
        ? "Parser health check timed out (service may still be waking up)."
        : "Parser service is not reachable yet.";

    console.warn("[parser][health] Unavailable: %s", message);

    return { status: "unavailable", message };
  }
}

/**
 * Returns true when a failed parser request is likely due to a Render free-tier
 * cold start rather than a client or permanent upstream error.
 *
 * @param {import('axios').AxiosError} err
 * @returns {boolean}
 */
function isColdStartError(err) {
  if (err.response) {
    const status = err.response.status;
    const contentType = String(
      err.response.headers?.["content-type"] ||
        err.response.headers?.["Content-Type"] ||
        ""
    );
    const bodyText = toHealthBodyText(err.response.data);
    if (isRenderBootPage(contentType, bodyText)) {
      return true;
    }
    return status === 429 || status === 502 || status === 503 || status === 504;
  }

  return err.code === "ECONNABORTED" || err.code === "ECONNRESET";
}

/**
 * Forwards an uploaded resume to the Python FastAPI parser service
 * (`POST {PARSER_SERVICE_URL}/parse`) and returns the parsed JSON.
 *
 * The file has already been validated and written to disk by multer, so we
 * stream it straight off disk into a multipart request rather than buffering
 * the whole PDF in memory.
 *
 * If the parser is waking up (common on Render free tier), the first failed
 * `/parse` wakes the instance, then retries with fixed delays — no health
 * polling (avoids Render 429 rate limits during boot).
 *
 * @param {Express.Multer.File} file - The file object provided by multer.
 * @returns {Promise<object>} The parser's JSON body, e.g.
 *   `{ success: true, filename, data: { ...structured resume... } }`.
 * @throws {ApiError} A clean, status-coded error on timeout, connection
 *   failure, or a parser-reported error.
 */
async function parseResume(file) {
  for (let attempt = 0; attempt < MAX_PARSE_ATTEMPTS; attempt++) {
    const form = buildParseForm(file);
    const parseTimeout =
      attempt === 0
        ? env.parserTimeoutMs
        : Math.max(env.parserTimeoutMs, PARSER_COLD_PARSE_TIMEOUT_MS);

    try {
      const { data } = await parserClient.post("/parse", form, {
        headers: form.getHeaders(),
        timeout: parseTimeout,
      });
      return data;
    } catch (err) {
      const isLastAttempt = attempt >= MAX_PARSE_ATTEMPTS - 1;
      if (!isLastAttempt && isColdStartError(err)) {
        const waitMs = COLD_START_PARSE_DELAYS_MS[attempt];
        console.info(
          "[parser] Cold start (attempt %d/%d); waiting %ds before /parse retry…",
          attempt + 1,
          MAX_PARSE_ATTEMPTS,
          Math.round(waitMs / 1000)
        );
        await delay(waitMs);
        continue;
      }
      throw normalizeParserError(err);
    }
  }
}

/**
 * Translates a low-level axios failure into a clean {@link ApiError} so the
 * frontend always receives a meaningful status code and message instead of a
 * raw stack trace or generic 500.
 *
 * @param {import('axios').AxiosError} err
 * @returns {ApiError}
 */
function normalizeParserError(err) {
  // 1. The parser responded, but with an error status (4xx/5xx).
  if (err.response) {
    const status = err.response.status;
    const contentType = String(
      err.response.headers?.["content-type"] ||
        err.response.headers?.["Content-Type"] ||
        ""
    );
    const bodyText = toHealthBodyText(err.response.data);
    if (isRenderBootPage(contentType, bodyText) || isTransientHealthStatus(status)) {
      return new ApiError(
        503,
        "Resume parser is still waking up. Please wait a minute and try again."
      );
    }

    const message =
      err.response.data?.error ||
      err.response.data?.message ||
      "Resume parser returned an error.";

    // Pass client errors (bad/empty/non-PDF) through unchanged; treat the
    // parser's own server errors as an upstream (502) failure.
    if (status === 429) {
      return new ApiError(
        503,
        "Resume parser is waking up and was temporarily rate limited. Please try again in a moment."
      );
    }
    if (status >= 400 && status < 500) {
      return new ApiError(status, message);
    }
    return new ApiError(502, `Resume parser failed: ${message}`);
  }

  // 2. The request was made but no response came back.
  if (err.code === "ECONNABORTED") {
    return new ApiError(
      504,
      "Resume parser timed out. Please try again with a smaller file."
    );
  }
  if (err.code === "ECONNREFUSED" || err.code === "ENOTFOUND") {
    return new ApiError(
      503,
      "Resume parser service is unavailable. Please try again later."
    );
  }

  // 3. Anything else (request setup error, unexpected network failure).
  return new ApiError(
    502,
    `Could not reach resume parser: ${err.message || "unknown error"}`
  );
}

module.exports = { parseResume, checkParserHealth };
