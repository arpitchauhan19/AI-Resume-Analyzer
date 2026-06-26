const ApiError = require("../middleware/ApiError");
const { saveUploadMetadata } = require("../services/uploadService");

/**
 * POST /api/upload
 * Receives a single PDF/DOCX file (already validated + stored by multer),
 * records its metadata, and returns details about the stored file.
 *
 * Note: the resume is intentionally NOT parsed/analyzed here.
 */
async function uploadResume(req, res, next) {
  try {
    if (!req.file) {
      throw new ApiError(400, "No file uploaded. Use form field 'resume'.");
    }

    const { filename, size, mimetype } = req.file;

    // Best-effort persistence of metadata (skipped if DB is unavailable).
    await saveUploadMetadata(req.file);

    res.status(201).json({
      success: true,
      filename,
      size,
      mimetype,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadResume };
