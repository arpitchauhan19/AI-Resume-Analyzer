const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const env = require("../config/env");
const ApiError = require("../middleware/ApiError");

/** Max time to poll /health while waiting for a cold-started parser (Render ~30–60s). */
const PARSER_WAKE_MAX_WAIT_MS = 90000;

/** Interval between /health polls during wake-up. */
const PARSER_WAKE_POLL_INTERVAL_MS = 5000;

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
 * Serializes a response body for structured log output.
 *
 * @param {unknown} data
 * @returns {string}
 */
function serializeHealthLogBody(data) {
  if (data === undefined) return "(undefined)";
  if (data === null) return "(null)";
  if (Buffer.isBuffer(data)) return data.toString("utf8");
  if (typeof data === "string") return data;
  try {
    return JSON.stringify(data);
  } catch {
    return String(data);
  }
}

/**
 * Normalizes the parser health JSON body regardless of axios responseType.
 *
 * @param {unknown} data
 * @returns {{ status?: string, message?: string } | null}
 */
function normalizeHealthBody(data) {
  if (data && typeof data === "object" && !Buffer.isBuffer(data) && !Array.isArray(data)) {
    return data;
  }
  if (typeof data === "string") {
    const trimmed = data.trim();
    if (!trimmed) return null;
    try {
      const parsed = JSON.parse(trimmed);
      return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
    } catch {
      return null;
    }
  }
  return null;
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
    const body = normalizeHealthBody(rawBody);
    const bodyStatus = body?.status;

    console.info(
      "[parser][health] Response: method=%s url=%s httpStatus=%s body=%s axiosCode=%s axiosMessage=%s parsedStatus=%s",
      method,
      healthUrl,
      httpStatus,
      serializeHealthLogBody(rawBody),
      "—",
      "—",
      bodyStatus ?? "(missing)"
    );

    if (httpStatus >= 200 && httpStatus < 300 && bodyStatus === "healthy") {
      return { status: "healthy" };
    }

    let message;
    if (httpStatus === 502 || httpStatus === 503 || httpStatus === 504) {
      message = "Parser service is still waking up.";
    } else if (httpStatus >= 200 && httpStatus < 300) {
      message =
        body?.message ||
        `Unexpected health payload (expected status "healthy", got ${JSON.stringify(bodyStatus)}).`;
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
    const axiosCode = err.code ?? "—";
    const axiosMessage = err.message ?? "unknown error";

    console.warn(
      "[parser][health] Error: method=%s url=%s httpStatus=%s body=%s axiosCode=%s axiosMessage=%s",
      method,
      healthUrl,
      httpStatus,
      serializeHealthLogBody(rawBody),
      axiosCode,
      axiosMessage
    );

    if (err.response?.status === 502 || err.response?.status === 503 || err.response?.status === 504) {
      return {
        status: "unavailable",
        message: "Parser service is still waking up.",
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
 * Polls parser `/health` until it reports healthy or the deadline passes.
 * Each probe triggers Render to keep booting a sleeping free-tier instance.
 *
 * @returns {Promise<boolean>} True when the parser responded healthy.
 */
async function waitForParserReady() {
  const deadline = Date.now() + PARSER_WAKE_MAX_WAIT_MS;
  let probe = 0;

  while (Date.now() < deadline) {
    probe += 1;
    const health = await checkParserHealth();
    if (health.status === "healthy") {
      console.info("[parser] Parser healthy after %d wake-up probe(s).", probe);
      return true;
    }

    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    await delay(Math.min(PARSER_WAKE_POLL_INTERVAL_MS, remaining));
  }

  console.warn(
    "[parser] Parser did not report healthy within %dms; retrying parse anyway.",
    PARSER_WAKE_MAX_WAIT_MS
  );
  return false;
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
    return status === 502 || status === 503 || status === 504;
  }

  return (
    err.code === "ECONNABORTED" ||
    err.code === "ECONNRESET"
  );
}

/**
 * Forwards an uploaded resume to the Python FastAPI parser service
 * (`POST {PARSER_SERVICE_URL}/parse`) and returns the parsed JSON.
 *
 * The file has already been validated and written to disk by multer, so we
 * stream it straight off disk into a multipart request rather than buffering
 * the whole PDF in memory.
 *
 * If the parser is waking up (common on Render free tier), polls `/health`
 * until the service is ready and retries the request once before surfacing
 * an error.
 *
 * @param {Express.Multer.File} file - The file object provided by multer.
 * @returns {Promise<object>} The parser's JSON body, e.g.
 *   `{ success: true, filename, data: { ...structured resume... } }`.
 * @throws {ApiError} A clean, status-coded error on timeout, connection
 *   failure, or a parser-reported error.
 */
async function parseResume(file) {
  for (let attempt = 0; attempt < 2; attempt++) {
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
      const canRetry = attempt === 0 && isColdStartError(err);
      if (canRetry) {
        console.info(
          "[parser] Cold start detected; polling /health for up to %ds…",
          PARSER_WAKE_MAX_WAIT_MS / 1000
        );
        await waitForParserReady();
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
    const message =
      err.response.data?.error ||
      err.response.data?.message ||
      "Resume parser returned an error.";

    // Pass client errors (bad/empty/non-PDF) through unchanged; treat the
    // parser's own server errors as an upstream (502) failure.
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
