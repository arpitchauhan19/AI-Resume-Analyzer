/**
 * GET /api/health
 * Simple liveness probe used by clients and orchestrators.
 */
function getHealth(req, res) {
  res.status(200).json({ status: "ok" });
}

module.exports = { getHealth };
