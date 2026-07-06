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

const api = axios.create({
  baseURL: configuredApiUrl || "http://localhost:5000",
});

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
      return "Could not reach the server. Please make sure the backend is running and try again.";
    }
    return err.message || "Something went wrong while uploading your resume.";
  }
  return "Something went wrong while uploading your resume.";
}

export default api;
