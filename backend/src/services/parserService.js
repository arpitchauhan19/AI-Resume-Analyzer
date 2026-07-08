const fs = require("fs");
const axios = require("axios");
const FormData = require("form-data");
const env = require("../config/env");
const ApiError = require("../middleware/ApiError");

/** Time to wait before retrying a parse request during a cold start. */
const PARSER_RETRY_DELAY_MS = 25000;

/** Timeout for parser liveness probes (shorter than parse; triggers wake-up). */
const PARSER_HEALTH_TIMEOUT_MS = 15000;

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
 * Pings the parser `GET /health` endpoint. Never throws — callers use this for
 * orchestrator health checks and cold-start warm-up without failing the API.
 *
 * @returns {Promise<{ status: "healthy" | "unavailable", message?: string }>}
 */
async function checkParserHealth() {
  try {
    const { data } = await parserClient.get("/health", {
      timeout: PARSER_HEALTH_TIMEOUT_MS,
    });
    if (data?.status === "healthy") {
      return { status: "healthy" };
    }
    return {
      status: "unavailable",
      message: data?.message || "Parser health check returned an unexpected response.",
    };
  } catch (err) {
    return {
      status: "unavailable",
      message: err.code === "ECONNABORTED"
        ? "Parser health check timed out (service may still be waking up)."
        : "Parser service is not reachable yet.",
    };
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
 * If the parser is waking up (common on Render free tier), waits once and
 * retries the request before surfacing an error.
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

    try {
      const { data } = await parserClient.post("/parse", form, {
        headers: form.getHeaders(),
        timeout: env.parserTimeoutMs,
      });
      return data;
    } catch (err) {
      const canRetry = attempt === 0 && isColdStartError(err);
      if (canRetry) {
        console.info(
          "[parser] Cold start detected; retrying parse in %dms…",
          PARSER_RETRY_DELAY_MS
        );
        await delay(PARSER_RETRY_DELAY_MS);
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
