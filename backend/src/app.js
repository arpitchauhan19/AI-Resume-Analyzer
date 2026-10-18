const path = require("path");
const fs = require("fs");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const env = require("./config/env");
const routes = require("./routes");
const notFound = require("./middleware/notFound");
const errorHandler = require("./middleware/errorHandler");

const app = express();

// Secure HTTP headers (allow inline styles and scripts if serving frontend build).
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

// Cross-origin access for the frontend. An empty origin list allows all.
app.use(
  cors({
    origin: env.corsOrigins.length ? env.corsOrigins : true,
  })
);

// Request logging (concise in dev, combined in production).
app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

// Body parsers for JSON and urlencoded payloads (uploads use multer).
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API routes.
app.use("/api", routes);

// ---- Serve the built React app in production (single-service deploy like PlaceTrack) ----
const frontendDist = path.resolve(__dirname, "../../frontend/dist");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // SPA fallback: any non-API GET returns index.html
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// 404 for unmatched routes, then the centralized error handler.
app.use(notFound);
app.use(errorHandler);

module.exports = app;
