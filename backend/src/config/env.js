const path = require("path");
const dotenv = require("dotenv");

dotenv.config();

const backendRoot = path.resolve(__dirname, "..", "..");

function parseOrigins(value) {
  if (!value) return [];
  return value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

const env = {
  nodeEnv: process.env.NODE_ENV || "development",
  port: Number(process.env.PORT) || 5000,
  mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/ai-resume-analyzer",
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN || "http://localhost:5173"),
  maxUploadSize: Number(process.env.MAX_UPLOAD_SIZE) || 5 * 1024 * 1024,
  uploadDir: path.resolve(backendRoot, process.env.UPLOAD_DIR || "src/uploads"),
};

module.exports = env;
