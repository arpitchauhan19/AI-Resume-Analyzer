const { checkParserHealth } = require("../services/parserService");

/**
 * GET /api/warmup
 * Returns immediately so the frontend is never blocked. Pings the parser
 * /health endpoint in the background to start Render's cold-boot sequence.
 */
function warmUp(req, res) {
  res.status(200).json({ status: "ok" });

  checkParserHealth().catch((err) => {
    console.warn("[warmup] Background parser ping failed:", err.message || err);
  });
}

module.exports = { warmUp };
