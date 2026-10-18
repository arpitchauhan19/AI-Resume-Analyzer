import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ui.css";
import "../styles/Upload.css";
import AppHeader from "../components/AppHeader";
import FileDropzone from "../components/FileDropzone";
import SelectedFileCard from "../components/SelectedFileCard";
import Button from "../components/Button";
import { ArrowRightIcon, AlertIcon } from "../components/icons";
import {
  uploadResume,
  warmUpBackend,
  checkParserReadiness,
  getErrorMessage,
} from "../lib/api";

/*
 * Resume upload page.
 * Lets the user pick a PDF via drag & drop or file browser, previews
 * the selection, and — on "Analyze" — uploads it to the backend parser
 * (POST /api/upload). While the request is in flight we show real upload
 * progress; on success we forward the parsed resume JSON to the dashboard,
 * and on failure we surface a readable error with a retry path.
 */
function UploadResume() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);

  // Request lifecycle state.
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Server readiness status: "checking" | "ready" | "warming"
  const [parserStatus, setParserStatus] = useState("checking");

  // Start waking the (Render free-tier) parser as soon as the user lands on the
  // upload page, and poll readiness until it reports ready.
  useEffect(() => {
    warmUpBackend();

    let isMounted = true;
    async function pollStatus() {
      const res = await checkParserReadiness();
      if (!isMounted) return;
      if (res.ready) {
        setParserStatus("ready");
      } else {
        setParserStatus("warming");
      }
    }

    pollStatus();
    const interval = setInterval(() => {
      if (parserStatus !== "ready") {
        pollStatus();
      }
    }, 5000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [parserStatus]);

  // Track upload / cold-start time while request is in flight
  useEffect(() => {
    if (!uploading) {
      setElapsedSeconds(0);
      return;
    }
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [uploading]);

  function handleSelect(selected) {
    setFile(selected);
    setError("");
    setProgress(0);
    // Picking a file is a strong signal an upload is imminent — nudge the parser
    // awake again in case it spun back down since page load.
    warmUpBackend();
  }

  function handleRemove() {
    setFile(null);
    setError("");
    setProgress(0);
  }

  async function handleAnalyze() {
    if (!file || uploading) return;

    setUploading(true);
    setError("");
    setProgress(0);
    setElapsedSeconds(0);

    try {
      const payload = await uploadResume(file, setProgress);

      // Hand the parsed resume + file name to the dashboard via router state.
      navigate("/dashboard", {
        state: {
          resume: payload.resume,
          fileName: payload.filename || file.name,
        },
        replace: true,
      });
    } catch (err) {
      setError(getErrorMessage(err));
      setUploading(false);
      setProgress(0);
    }
  }

  return (
    <div className="app-page">
      <div className="app-glow" />
      <AppHeader />

      <main className="app-page__main">
        <section className="upload container">
          <div className="upload__head">
            <span className="upload__eyebrow">Step 1 of 2</span>
            <h1 className="upload__title">Upload your resume</h1>
            <p className="upload__subtitle">
              Drop your resume below and our AI will score it against ATS
              systems, surface missing keywords and suggest improvements.
            </p>
            <div
              className="upload__server-status"
              title="Render free tier automatically sleeps after 15m of inactivity"
            >
              <span
                className={`upload__status-dot upload__status-dot--${
                  parserStatus === "ready" ? "ready" : "warming"
                }`}
              />
              <span>
                {parserStatus === "ready"
                  ? "AI Engine Online & Ready"
                  : "Waking up AI Engine (Render free tier cold start ~45s)..."}
              </span>
            </div>
          </div>

          <div className="upload__panel">
            {file ? (
              <SelectedFileCard
                file={file}
                onRemove={uploading ? undefined : handleRemove}
              />
            ) : (
              <FileDropzone onSelect={handleSelect} />
            )}

            {/* Loading state: real upload/parse progress. */}
            {uploading && (
              <div className="upload__progress" role="status" aria-live="polite">
                <div className="upload__progress-head">
                  <span className="upload__spinner" aria-hidden="true" />
                  <span>
                    {progress < 100
                      ? `Uploading… ${progress}%`
                      : elapsedSeconds > 6
                      ? "Waking up AI Engine on Render (~30–60s cold start)…"
                      : "Parsing your resume with AI…"}
                  </span>
                </div>
                <div
                  className="upload__progress-track"
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <div
                    className="upload__progress-fill"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                {elapsedSeconds > 6 && (
                  <p className="upload__cold-start-hint">
                    Render free-tier instances sleep when idle. Your resume is being processed and will display automatically once booted!
                  </p>
                )}
              </div>
            )}

            {/* Error state: failed request, with a clear retry affordance. */}
            {error && !uploading && (
              <p className="upload__error" role="alert">
                <AlertIcon width={18} height={18} />
                {error}
              </p>
            )}

            <div className="upload__actions">
              <Button
                onClick={handleAnalyze}
                disabled={!file || uploading}
                icon={<ArrowRightIcon width={19} height={19} />}
                style={
                  !file || uploading
                    ? { opacity: 0.55, cursor: "not-allowed" }
                    : undefined
                }
              >
                {uploading
                  ? "Analyzing…"
                  : error
                  ? "Try Again"
                  : "Analyze Resume"}
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default UploadResume;
