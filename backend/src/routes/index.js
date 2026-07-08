const express = require("express");
const healthRoutes = require("./healthRoutes");
const warmupRoutes = require("./warmupRoutes");
const uploadRoutes = require("./uploadRoutes");
const atsRoutes = require("./atsRoutes");

const router = express.Router();

// Mounted under /api in app.js
router.use("/health", healthRoutes);
router.use("/warmup", warmupRoutes);
router.use("/upload", uploadRoutes);
router.use("/ats", atsRoutes);

module.exports = router;
