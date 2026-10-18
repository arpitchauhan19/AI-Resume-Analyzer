const {
  waitForParserAwake,
  isParserLikelyAwake,
  markParserAwake,
} = require("../services/parserService");

// Ensures only one background wake loop runs at a time (repeated warmup pings
// from the frontend won't stack up concurrent health polls / trip Render 429).
let warmingUp = false;

/**
 * GET /api/warmup
 * Returns immediately so the frontend is never blocked, reporting whether
 * the parser is already verified awake or currently warming up.
 *
 * If the parser is cold, kicks off a background wake loop so the container
 * spins up while the user is browsing / selecting their resume.
 */
function warmUp(req, res) {
  const parserReady = isParserLikelyAwake();

  res.status(200).json({
    status: "ok",
    parserReady,
    warmingUp,
  });

  if (warmingUp || parserReady) return;
  warmingUp = true;

  waitForParserAwake()
    .then((awake) => {
      if (awake) markParserAwake();
    })
    .catch((err) => {
      console.warn("[warmup] Background parser wake failed:", err.message || err);
    })
    .finally(() => {
      warmingUp = false;
    });
}

module.exports = { warmUp };
