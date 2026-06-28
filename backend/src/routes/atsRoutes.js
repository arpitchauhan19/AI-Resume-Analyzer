const express = require("express");
const { analyze } = require("../controllers/atsController");

const router = express.Router();

// POST /api/ats/analyze  (application/json)
router.post("/analyze", analyze);

module.exports = router;
