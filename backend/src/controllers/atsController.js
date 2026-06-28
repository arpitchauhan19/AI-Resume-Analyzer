const ApiError = require("../middleware/ApiError");
const { analyzeResume } = require("../services/atsService");

/**
 * POST /api/ats/analyze
 * Body: { resume: <parsed resume JSON>, jobDescription: <string> }
 *
 * Validates the request, runs the ATS engine, and returns the scoring report.
 * The parsed resume is the same `resume` object the upload endpoint returns,
 * so the frontend can pass it straight through alongside a job description.
 */
function analyze(req, res, next) {
  try {
    const { resume, jobDescription } = req.body || {};

    if (!resume || typeof resume !== "object" || Array.isArray(resume)) {
      throw new ApiError(400, "A parsed 'resume' object is required.");
    }
    if (typeof jobDescription !== "string" || !jobDescription.trim()) {
      throw new ApiError(400, "A non-empty 'jobDescription' string is required.");
    }

    const result = analyzeResume(resume, jobDescription);

    res.status(200).json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
}

module.exports = { analyze };
