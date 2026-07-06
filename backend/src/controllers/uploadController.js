const ApiError = require("../middleware/ApiError");
const { saveUploadMetadata } = require("../services/uploadService");
const { parseResume } = require("../services/parserService");

/**
 * POST /api/upload
 * Receives a single PDF file (already validated + stored by multer),
 * records its metadata, forwards the file to the Python FastAPI parser
 * service, and returns the structured resume JSON to the frontend.
 */
async function uploadResume(req, res, next) {
  try {
    if (!req.file) {
      throw new ApiError(400, "No file uploaded. Use form field 'resume'.");
    }

    const { filename, size, mimetype } = req.file;

    // Best-effort persistence of metadata (skipped if DB is unavailable).
    await saveUploadMetadata(req.file);

    // Forward the file to the Python parser and await the structured result.
    const parsed = await parseResume(req.file);

    res.status(200).json({
      success: true,
      filename,
      size,
      mimetype,
      // The parser wraps the result in `{ success, filename, data }`; expose
      // the structured resume under `resume` (fall back to the raw payload).
      resume: parsed.data ?? parsed,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadResume };
