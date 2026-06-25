import "../styles/Features.css";
import FeatureCard from "./FeatureCard";
import { BulbIcon, DocumentIcon, GaugeIcon, TargetIcon } from "./icons";

/* Feature definitions — data-driven so cards stay easy to extend. */
const FEATURES = [
  {
    icon: <GaugeIcon width={24} height={24} />,
    title: "ATS Score",
    text: "See how applicant tracking systems rate your resume with a clear, actionable score.",
  },
  {
    icon: <DocumentIcon width={24} height={24} />,
    title: "Resume Parsing",
    text: "Automatically extract skills, experience and education from any PDF or DOCX file.",
  },
  {
    icon: <BulbIcon width={24} height={24} />,
    title: "AI Suggestions",
    text: "Get tailored, line-by-line feedback to sharpen impact and fix common mistakes.",
  },
  {
    icon: <TargetIcon width={24} height={24} />,
    title: "Job Match %",
    text: "Compare your resume against any job description and measure your fit instantly.",
  },
];

function Features() {
  return (
    <section className="features section" id="features">
      <div className="container">
        <div className="features__head">
          <span className="features__eyebrow">Everything you need</span>
          <h2 className="features__title">
            Smarter insights for a stronger resume
          </h2>
          <p className="features__subtitle">
            Powerful analysis tools that help you understand, refine and tailor
            your resume for every opportunity.
          </p>
        </div>

        <div className="features__grid">
          {FEATURES.map((feature, i) => (
            <FeatureCard
              key={feature.title}
              icon={feature.icon}
              title={feature.title}
              text={feature.text}
              delay={i * 90}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export default Features;
