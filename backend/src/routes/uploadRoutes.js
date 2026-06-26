const express = require("express");
const upload = require("../middleware/upload");
const { uploadResume } = require("../controllers/uploadController");

const router = express.Router();

// POST /api/upload  (multipart/form-data, field name: "resume")
router.post("/", upload, uploadResume);

module.exports = router;
