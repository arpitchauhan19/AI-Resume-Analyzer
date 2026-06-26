import { Link, useLocation } from "react-router-dom";
import "../styles/ui.css";
import "../styles/Dashboard.css";
import AppHeader from "../components/AppHeader";
import Card from "../components/Card";
import StatCard from "../components/StatCard";
import ProgressBar from "../components/ProgressBar";
import CircularScore from "../components/CircularScore";
import Button from "../components/Button";
import {
  GaugeIcon,
  TargetIcon,
  DocumentIcon,
  KeyIcon,
  LayersIcon,
  AlertIcon,
  BulbIcon,
  StarIcon,
  CheckIcon,
  TrendUpIcon,
  ArrowLeftIcon,
} from "../components/icons";

/* ============================================================
   FAKE DATA — hard-coded sample analysis. No API is called.
   ============================================================ */
const DATA = {
  atsScore: 82,
  skillMatch: 76,
  resumeScore: 88,
  skillProgress: [
    { label: "Frontend Development", value: 92 },
    { label: "Backend Development", value: 71 },
    { label: "Cloud & DevOps", value: 64 },
    { label: "Data & Analytics", value: 58 },
  ],
  topSkills: ["React", "JavaScript", "TypeScript", "Node.js", "CSS", "Git"],
  weakSkills: [
    { label: "Kubernetes", value: 28 },
    { label: "GraphQL", value: 35 },
    { label: "System Design", value: 42 },
  ],
  missingKeywords: [
    "CI/CD",
    "Microservices",
    "Agile",
    "Unit Testing",
    "Docker",
    "REST API",
    "Scalability",
  ],
  aiSuggestions: [
    {
      title: "Quantify your impact",
      text: "Add metrics to your experience bullets (e.g. “improved load time by 40%”) to stand out to recruiters.",
    },
    {
      title: "Tailor to the job description",
      text: "Mirror keywords from the target role — your resume is missing several ATS-critical terms.",
    },
    {
      title: "Strengthen your summary",
      text: "Lead with a 2-line headline that highlights your strongest, most relevant achievements.",
    },
  ],
  improvementTips: [
    {
      tone: "warn",
      title: "Add missing keywords",
      text: "Weave in CI/CD, Docker and Microservices where relevant to lift your ATS score.",
    },
    {
      tone: "good",
      title: "Great formatting",
      text: "Clean structure and consistent headings — ATS parsers will read this easily.",
    },
    {
      tone: "brand",
      title: "Shorten long bullets",
      text: "Keep bullet points under two lines for better readability and scanning.",
    },
  ],
};

function Dashboard() {
  const location = useLocation();
  const fileName = location.state?.fileName || "your-resume.pdf";

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
              <span className="dashboard__file">
                <DocumentIcon width={16} height={16} />
                {fileName}
              </span>
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

          {/* Summary stat cards */}
          <div className="dashboard__stats">
            <StatCard
              icon={<GaugeIcon width={22} height={22} />}
              label="ATS Score"
              value={`${DATA.atsScore}%`}
              delta="+12"
              trend="up"
              delay={0}
            />
            <StatCard
              icon={<TargetIcon width={22} height={22} />}
              label="Skill Match"
              value={`${DATA.skillMatch}%`}
              delta="+8"
              trend="up"
              delay={80}
            />
            <StatCard
              icon={<DocumentIcon width={22} height={22} />}
              label="Resume Score"
              value={`${DATA.resumeScore}/100`}
              delta="+5"
              trend="up"
              delay={160}
            />
            <StatCard
              icon={<KeyIcon width={22} height={22} />}
              label="Missing Keywords"
              value={DATA.missingKeywords.length}
              delta="-3"
              trend="down"
              delay={240}
            />
          </div>

          {/* Main grid */}
          <div className="dashboard__grid">
            {/* Circular ATS Score */}
            <Card
              className="col-4"
              title="ATS Score"
              icon={<GaugeIcon width={20} height={20} />}
            >
              <div className="ats-card">
                <div className="ats-card__ring">
                  <CircularScore value={DATA.atsScore} caption="ATS Score" />
                </div>
                <p className="ats-card__note">
                  Strong — your resume passes most applicant tracking systems.
                </p>
              </div>
            </Card>

            {/* Skill Progress */}
            <Card
              className="col-8"
              title="Skill Progress"
              icon={<LayersIcon width={20} height={20} />}
            >
              <div className="bar-stack">
                {DATA.skillProgress.map((s, i) => (
                  <ProgressBar
                    key={s.label}
                    label={s.label}
                    value={s.value}
                    delay={i * 120}
                  />
                ))}
              </div>
            </Card>

            {/* Top Skills */}
            <Card
              className="col-6"
              title="Top Skills"
              icon={<StarIcon width={20} height={20} />}
            >
              <div className="skill-tags">
                {DATA.topSkills.map((skill) => (
                  <span className="skill-tag" key={skill}>
                    <span className="skill-tag__dot" />
                    {skill}
                  </span>
                ))}
              </div>
            </Card>

            {/* Weak Skills */}
            <Card
              className="col-6"
              title="Weak Skills"
              icon={<TrendUpIcon width={20} height={20} />}
            >
              <div className="bar-stack">
                {DATA.weakSkills.map((s, i) => (
                  <ProgressBar
                    key={s.label}
                    label={s.label}
                    value={s.value}
                    variant="warn"
                    delay={i * 120}
                  />
                ))}
              </div>
            </Card>

            {/* AI Suggestions */}
            <Card
              className="col-7"
              title="AI Suggestions"
              icon={<BulbIcon width={20} height={20} />}
            >
              <ul className="tip-list">
                {DATA.aiSuggestions.map((s) => (
                  <li className="tip" key={s.title}>
                    <span className="tip__icon">
                      <BulbIcon width={17} height={17} />
                    </span>
                    <div>
                      <div className="tip__title">{s.title}</div>
                      <p className="tip__text">{s.text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>

            {/* Missing Keywords */}
            <Card
              className="col-5"
              title="Missing Keywords"
              icon={<KeyIcon width={20} height={20} />}
            >
              <div className="skill-tags">
                {DATA.missingKeywords.map((kw) => (
                  <span className="skill-tag skill-tag--missing" key={kw}>
                    <span className="skill-tag__dot" />
                    {kw}
                  </span>
                ))}
              </div>
            </Card>

            {/* Improvement Tips */}
            <Card
              className="col-12"
              title="Improvement Tips"
              icon={<CheckIcon width={20} height={20} />}
            >
              <ul className="tip-list">
                {DATA.improvementTips.map((t) => {
                  const iconClass =
                    t.tone === "warn"
                      ? "tip__icon tip__icon--warn"
                      : t.tone === "good"
                      ? "tip__icon tip__icon--good"
                      : "tip__icon";
                  const Icon =
                    t.tone === "warn"
                      ? AlertIcon
                      : t.tone === "good"
                      ? CheckIcon
                      : BulbIcon;
                  return (
                    <li className="tip" key={t.title}>
                      <span className={iconClass}>
                        <Icon width={17} height={17} />
                      </span>
                      <div>
                        <div className="tip__title">{t.title}</div>
                        <p className="tip__text">{t.text}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          </div>
        </section>
      </main>
    </div>
  );
}

export default Dashboard;
