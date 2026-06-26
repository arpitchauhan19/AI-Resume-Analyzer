const app = require("./app");
const env = require("./config/env");
const connectDB = require("./config/db");

let server;

function start() {
  // Start the HTTP server first so health checks and uploads are immediately
  // available, then connect to MongoDB in the background. If the DB is
  // unavailable the API still runs (metadata persistence is simply skipped).
  server = app.listen(env.port, () => {
    console.log(`[server] Listening on http://localhost:${env.port} (${env.nodeEnv})`);
  });

  connectDB().catch((err) => {
    console.error("[startup] MongoDB connection failed:", err.message);
    console.error("[startup] Continuing without a database connection.");
  });
}

// Graceful shutdown on termination signals.
function shutdown(signal) {
  console.log(`\n[server] ${signal} received, shutting down...`);
  if (server) {
    server.close(() => {
      console.log("[server] Closed remaining connections. Bye!");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

// Surface unexpected failures instead of dying silently.
process.on("unhandledRejection", (reason) => {
  console.error("[server] Unhandled promise rejection:", reason);
});

start();
