import { Link, useLocation } from "react-router-dom";
import "../styles/ui.css";
import "../styles/Dashboard.css";
import AppHeader from "../components/AppHeader";
import Card from "../components/Card";
import StatCard from "../components/StatCard";
import Button from "../components/Button";
import {
  DocumentIcon,
  LayersIcon,
  StarIcon,
  TargetIcon,
  BulbIcon,
  ArrowLeftIcon,
  UploadIcon,
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
