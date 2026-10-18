import axios from "axios";

/*
 * Base URL for the Node/Express backend.
 *
 * Resolution rules (Vite inlines env vars at BUILD time):
 *   - Configured explicitly via `VITE_API_URL` — recommended for every real
 *     deployment (dev, staging, production).
 *   - Local development (`vite dev`) falls back to the backend the project
 *     ships with on :5000 so `npm run dev` works with zero configuration.
 *   - In a PRODUCTION build the localhost fallback is intentionally removed:
 *     if `VITE_API_URL` was not provided at build time we fail loudly instead
 *     of silently shipping a bundle that points at the end-user's own machine.
 */
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

if (!configuredApiUrl && import.meta.env.PROD) {
  throw new Error(
    "[config] VITE_API_URL is not set. Define it at build time " +
      "(e.g. VITE_API_URL=https://api.example.com npm run build) so the " +
      "production build targets your deployed backend instead of localhost."
  );
}

const configuredParserUrl = import.meta.env.VITE_PARSER_URL?.trim();

const api = axios.create({
  baseURL: configuredApiUrl || "http://localhost:5000",
});

/** Allow enough time for a cold Render backend to wake on the first probe. */
const WARMUP_TIMEOUT_MS = 90000;

/**
 * Silently warm up the backend and parser on app load.
 * Fire-and-forget — never blocks the UI and errors are ignored.
 *
 * 1. Pings the backend's /api/warmup (which triggers background parser wake).
 * 2. If VITE_PARSER_URL is set, also fires a direct browser request to the
 *    parser's /health endpoint. This triggers Render's cold-boot container
 *    directly from the browser, exactly like opening the URL in another tab.
 */
export function warmUpBackend() {
  api.get("/api/warmup", { timeout: WARMUP_TIMEOUT_MS }).catch(() => {});

  if (configuredParserUrl) {
    try {
      fetch(`${configuredParserUrl}/health`, { mode: "no-cors" }).catch(() => {});
    } catch {
      // Ignore network errors on background probe
    }
  }
}

/**
 * Quick, non-blocking check to determine if the parser is known to be ready.
 *
 * @returns {Promise<{ ok: boolean, ready: boolean, warmingUp: boolean }>}
 */
export async function checkParserReadiness() {
  try {
    const res = await api.get("/api/warmup", { timeout: 10000 });
    return {
      ok: res.data?.status === "ok",
      ready: Boolean(res.data?.parserReady),
      warmingUp: Boolean(res.data?.warmingUp),
    };
  } catch {
    return { ok: false, ready: false, warmingUp: false };
  }
}

/**
 * Upload a resume file to the backend parser.
 *
 * @param {File} file               The PDF selected by the user.
 * @param {(percent:number)=>void} [onProgress]  Upload progress callback (0–100).
 * @returns {Promise<object>}        The backend payload:
 *   `{ success, filename, size, mimetype, resume: { contact, skills, ... } }`
 */
export async function uploadResume(file, onProgress) {
  const formData = new FormData();
  // Backend's multer middleware expects the field name "resume".
  formData.append("resume", file);

  const { data } = await api.post("/api/upload", formData, {
    onUploadProgress: (event) => {
      if (!onProgress || !event.total) return;
      onProgress(Math.round((event.loaded * 100) / event.total));
    },
  });

  return data;
}

/**
 * Upload a resume file with automatic retry for Render free-tier cold starts.
 *
 * If Render returns a temporary network/edge drop (ERR_NETWORK) or 502/503/504 while waking up,
 * we patiently retry instead of throwing a false-positive fatal error.
 *
 * @param {File} file
 * @param {(percent: number) => void} [onProgress]
 * @param {(statusMessage: string) => void} [onStatus]
 * @returns {Promise<object>}
 */
export async function uploadResumeWithRetry(file, onProgress, onStatus) {
  const maxAttempts = 12;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (attempt > 1 && onStatus) {
        onStatus(`Waking up server on Render (attempt ${attempt}/${maxAttempts})…`);
      }
      return await uploadResume(file, onProgress);
    } catch (err) {
      const isNetworkOrColdStart =
        err.code === "ERR_NETWORK" ||
        err.message?.includes("Network Error") ||
        err.response?.status === 502 ||
        err.response?.status === 503 ||
        err.response?.status === 504 ||
        (typeof err.response?.data?.message === "string" &&
          err.response.data.message.toLowerCase().includes("waking up"));

      if (isNetworkOrColdStart && attempt < maxAttempts) {
        if (onStatus) {
          onStatus(
            `Server is waking up on Render (~45s free tier boot)… Reconnecting in 5s (attempt ${attempt}/${maxAttempts})`
          );
        }
        await new Promise((resolve) => setTimeout(resolve, 5000));
        continue;
      }
      throw err;
    }
  }
}

/**
 * Run the ATS analysis for a parsed resume against a job description.
 *
 * Calls the Express ATS engine (`POST /api/ats/analyze`) which returns the
 * real ATS score, matched/missing keywords and suggestions.
 *
 * @param {object} resume          The parsed resume object (from uploadResume).
 * @param {string} jobDescription  Raw job description text.
 * @returns {Promise<{
 *   atsScore: number,
 *   skillMatch: number,
 *   matchedKeywords: string[],
 *   missingKeywords: string[],
 *   resumeCompleteness: number,
 *   suggestions: string[]
 * }>}
 */
export async function analyzeAts(resume, jobDescription) {
  const { data } = await api.post("/api/ats/analyze", {
    resume,
    jobDescription,
  });
  return data;
}

/**
 * Turn any axios/backend error into a single human-readable message.
 * The backend's error handler responds with `{ message }` (or `{ error }`),
 * so we surface that when available and fall back to network-level hints.
 *
 * @param {unknown} err
 * @returns {string}
 */
export function getErrorMessage(err) {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    if (data && (data.message || data.error)) {
      return data.message || data.error;
    }
    if (err.code === "ERR_NETWORK") {
      return "Could not reach the server. The free-tier backend is currently waking up on Render (~45s). Please wait a few seconds and try again!";
    }
    return err.message || "Something went wrong while uploading your resume.";
  }
  return "Something went wrong while uploading your resume.";
}

export default api;
