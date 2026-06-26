import { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/ui.css";
import "../styles/Upload.css";
import AppHeader from "../components/AppHeader";
import FileDropzone from "../components/FileDropzone";
import SelectedFileCard from "../components/SelectedFileCard";
import Button from "../components/Button";
import { ArrowRightIcon } from "../components/icons";

/*
 * Resume upload page.
 * Lets the user pick a PDF/DOCX via drag & drop or file browser, previews
 * the selection, and — on "Analyze" — routes to the loading animation.
 * NOTE: nothing is sent to a backend; the file stays in local state and
 * only the file name is forwarded to the next screen for display.
 */
function UploadResume() {
  const navigate = useNavigate();
  const [file, setFile] = useState(null);

  function handleAnalyze() {
    if (!file) return;
    navigate("/loading", { state: { fileName: file.name } });
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
              <SelectedFileCard file={file} onRemove={() => setFile(null)} />
            ) : (
              <FileDropzone onSelect={setFile} />
            )}

            <div className="upload__actions">
              <Button
                onClick={handleAnalyze}
                disabled={!file}
                icon={<ArrowRightIcon width={19} height={19} />}
                style={!file ? { opacity: 0.55, cursor: "not-allowed" } : undefined}
              >
                Analyze Resume
              </Button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default UploadResume;
