import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ui.css";
import "../styles/Upload.css";
import AppHeader from "../components/AppHeader";
import FileDropzone from "../components/FileDropzone";
import SelectedFileCard from "../components/SelectedFileCard";
import Button from "../components/Button";
import { ArrowRightIcon, AlertIcon } from "../components/icons";
import { uploadResume, getErrorMessage } from "../lib/api";

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

  function handleSelect(selected) {
    setFile(selected);
    setError("");
    setProgress(0);
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
                      : "Parsing your resume…"}
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
