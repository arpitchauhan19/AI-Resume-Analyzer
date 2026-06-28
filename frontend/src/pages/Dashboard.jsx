import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import "../styles/ui.css";
import "../styles/Dashboard.css";
import AppHeader from "../components/AppHeader";
import Card from "../components/Card";
import StatCard from "../components/StatCard";
import Button from "../components/Button";
import CircularScore from "../components/CircularScore";
import ProgressBar from "../components/ProgressBar";
import { analyzeAts, getErrorMessage } from "../lib/api";
import {
  DocumentIcon,
  LayersIcon,
  StarIcon,
  TargetIcon,
  BulbIcon,
  ArrowLeftIcon,
  UploadIcon,
  KeyIcon,
  CheckIcon,
  CloseIcon,
  AlertIcon,
} from "../components/icons";

/* Small inline placeholder shown whenever a section has no data. */
function NotFound({ label = "Not found" }) {
  return <p className="not-found">{label}</p>;
}

/* Renders a list of free-text items, or a graceful fallback when empty. */
function ItemList({ items }) {
  if (!items || items.length === 0) {
    return <NotFound />;
  }
  return (
    <ul className="item-list">
      {items.map((item, i) => (
        <li className="item-list__row" key={`${item}-${i}`}>
          {item}
        </li>
      ))}
    </ul>
  );
}

/* Single contact detail row (Name / Email / Phone). */
function ContactRow({ label, value }) {
  return (
    <div className="contact-row">
      <span className="contact-row__label">{label}</span>
      {value ? (
        <span className="contact-row__value">{value}</span>
      ) : (
        <NotFound />
      )}
    </div>
  );
}

/* Renders matched/missing keywords as colour-coded skill tags. */
function KeywordTags({ keywords, missing = false }) {
  if (!keywords || keywords.length === 0) {
    return <NotFound label={missing ? "No gaps found" : "No matches yet"} />;
  }
  return (
    <div className="skill-tags">
      {keywords.map((kw, i) => (
        <span
          className={`skill-tag ${missing ? "skill-tag--missing" : ""}`.trim()}
          key={`${kw}-${i}`}
        >
          <span className="skill-tag__dot" />
          {kw}
        </span>
      ))}
    </div>
  );
}

/*
 * ATS Match panel: lets the user paste a job description, sends the parsed
 * resume + JD to the Express ATS engine (POST /api/ats/analyze), and renders
 * the real score, keyword breakdown and suggestions.
 */
function AtsMatch({ resume }) {
  const [jobDescription, setJobDescription] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const canAnalyze = jobDescription.trim().length > 0 && !loading;

  async function handleAnalyze() {
    if (!canAnalyze) return;
    setLoading(true);
    setError("");
    try {
      const data = await analyzeAts(resume, jobDescription);
      setResult(data);
    } catch (err) {
      setError(getErrorMessage(err));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      {/* Job description input */}
      <Card
        className="col-12"
        title="ATS Match"
        icon={<TargetIcon width={20} height={20} />}
      >
        <p className="ats-intro">
          Paste a job description to score your resume against it and reveal the
          keywords an ATS would look for.
        </p>
        <textarea
          className="ats-textarea"
          rows={6}
          placeholder="Paste the job description here…"
          value={jobDescription}
          onChange={(e) => setJobDescription(e.target.value)}
        />
        <div className="ats-actions">
          <Button
            onClick={handleAnalyze}
            disabled={!canAnalyze}
            icon={<TargetIcon width={18} height={18} />}
          >
            {loading ? "Analyzing…" : "Analyze ATS Match"}
          </Button>
        </div>

        {error && (
          <div className="ats-error" role="alert">
            <AlertIcon width={18} height={18} />
            <span>{error}</span>
          </div>
        )}
      </Card>

      {/* Results — only once we have a real response */}
      {result && (
        <>
          <Card
            className="col-4 ats-card"
            title="ATS Score"
            icon={<StarIcon width={20} height={20} />}
          >
            <div className="ats-card__ring">
              <CircularScore value={result.atsScore} caption="ATS Score" />
            </div>
            <div className="bar-stack" style={{ width: "100%" }}>
              <ProgressBar
                label="Skill Match"
                value={result.skillMatch}
                variant={result.skillMatch < 50 ? "warn" : "brand"}
              />
              {typeof result.resumeCompleteness === "number" && (
                <ProgressBar
                  label="Resume Completeness"
                  value={result.resumeCompleteness}
                  variant={result.resumeCompleteness < 50 ? "warn" : "brand"}
                  delay={120}
                />
              )}
            </div>
          </Card>

          <Card
            className="col-8"
            title="Matched Keywords"
            icon={<CheckIcon width={20} height={20} />}
          >
            <KeywordTags keywords={result.matchedKeywords} />
          </Card>

          <Card
            className="col-6"
            title="Missing Keywords"
            icon={<CloseIcon width={20} height={20} />}
          >
            <KeywordTags keywords={result.missingKeywords} missing />
          </Card>

          <Card
            className="col-6"
            title="Suggestions"
            icon={<KeyIcon width={20} height={20} />}
          >
            {result.suggestions && result.suggestions.length > 0 ? (
              <ul className="tip-list">
                {result.suggestions.map((tip, i) => (
                  <li className="tip" key={`${i}-${tip.slice(0, 12)}`}>
                    <span className="tip__icon">
                      <BulbIcon width={18} height={18} />
                    </span>
                    <div>
                      <p className="tip__text">{tip}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <NotFound label="No suggestions" />
            )}
          </Card>
        </>
      )}
    </>
  );
}

function Dashboard() {
  const location = useLocation();
  const resume = location.state?.resume;
  const fileName = location.state?.fileName;

  /* ---------- Empty state ----------
     Reached on a hard refresh or direct navigation, when no parsed resume
     was handed over from the upload flow. */
  if (!resume) {
    return (
      <div className="app-page">
        <div className="app-glow" />
        <AppHeader />
        <main className="app-page__main">
          <section className="dashboard container">
            <div className="empty-state">
              <span className="empty-state__icon">
                <UploadIcon width={30} height={30} />
              </span>
              <h1 className="empty-state__title">No resume analyzed yet</h1>
              <p className="empty-state__text">
                Upload a resume to see your parsed insights here. Results are
                generated the moment your file finishes processing.
              </p>
              <Button
                as={Link}
                to="/upload"
                icon={<UploadIcon width={18} height={18} />}
              >
                Upload a resume
              </Button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const contact = resume.contact || {};
  const skills = resume.skills || [];
  const education = resume.education || [];
  const experience = resume.experience || [];
  const projects = resume.projects || [];

  return (
    <div className="app-page">
      <div className="app-glow" />
      <AppHeader />

      <main className="app-page__main">
        <section className="dashboard container">
          {/* Page header */}
          <div className="dashboard__head">
            <div>
              <span className="dashboard__eyebrow">Analysis complete</span>
              <h1 className="dashboard__title">Your Resume Insights</h1>
              {fileName && (
                <span className="dashboard__file">
                  <DocumentIcon width={16} height={16} />
                  {fileName}
                </span>
              )}
            </div>
            <Button
              as={Link}
              to="/upload"
              variant="secondary"
              icon={<ArrowLeftIcon width={18} height={18} />}
            >
              Analyze another
            </Button>
          </div>

          {/* Summary stat cards — real counts from the parsed resume */}
          <div className="dashboard__stats">
            <StatCard
              icon={<StarIcon width={22} height={22} />}
              label="Skills"
              value={skills.length}
              delay={0}
            />
            <StatCard
              icon={<TargetIcon width={22} height={22} />}
              label="Experience"
              value={experience.length}
              delay={80}
            />
            <StatCard
              icon={<BulbIcon width={22} height={22} />}
              label="Projects"
              value={projects.length}
              delay={160}
            />
            <StatCard
              icon={<LayersIcon width={22} height={22} />}
              label="Education"
              value={education.length}
              delay={240}
            />
          </div>

          {/* Main grid */}
          <div className="dashboard__grid">
            {/* ATS match: job description input + real score & keywords */}
            <AtsMatch resume={resume} />

            {/* Contact details */}
            <Card
              className="col-4"
              title="Contact"
              icon={<DocumentIcon width={20} height={20} />}
            >
              <div className="contact-list">
                <ContactRow label="Name" value={contact.name} />
                <ContactRow label="Email" value={contact.email} />
                <ContactRow label="Phone" value={contact.phone} />
              </div>
            </Card>

            {/* Skills */}
            <Card
              className="col-8"
              title="Skills"
              icon={<StarIcon width={20} height={20} />}
            >
              {skills.length > 0 ? (
                <div className="skill-tags">
                  {skills.map((skill, i) => (
                    <span className="skill-tag" key={`${skill}-${i}`}>
                      <span className="skill-tag__dot" />
                      {skill}
                    </span>
                  ))}
                </div>
              ) : (
                <NotFound />
              )}
            </Card>

            {/* Experience */}
            <Card
              className="col-6"
              title="Experience"
              icon={<TargetIcon width={20} height={20} />}
            >
              <ItemList items={experience} />
            </Card>

            {/* Projects */}
            <Card
              className="col-6"
              title="Projects"
              icon={<BulbIcon width={20} height={20} />}
            >
              <ItemList items={projects} />
            </Card>

            {/* Education */}
            <Card
              className="col-12"
              title="Education"
              icon={<LayersIcon width={20} height={20} />}
            >
              <ItemList items={education} />
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
