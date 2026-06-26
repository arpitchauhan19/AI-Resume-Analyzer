const mongoose = require("mongoose");
const Upload = require("../models/Upload");

/**
 * Persists metadata for an uploaded file.
 *
 * Persistence is best-effort: if MongoDB is not connected we skip the DB
 * write rather than failing the request, since the file is already saved
 * on disk and parsing/analysis is explicitly out of scope.
 *
 * @param {Express.Multer.File} file - The file object provided by multer.
 * @returns {Promise<import('../models/Upload')|null>}
 */
async function saveUploadMetadata(file) {
  const isConnected = mongoose.connection.readyState === 1;
  if (!isConnected) {
    return null;
  }

  return Upload.create({
    filename: file.filename,
    originalName: file.originalname,
    mimetype: file.mimetype,
    size: file.size,
    path: file.path,
  });
}

module.exports = { saveUploadMetadata };
