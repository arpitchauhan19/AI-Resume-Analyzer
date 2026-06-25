import "../styles/Hero.css";
import Button from "./Button";
import { CheckIcon, PlayIcon, SparkleIcon, UploadIcon } from "./icons";

/* Static demo data for the floating analysis mockup. */
const SKILL_BARS = [
  { label: "Skill Match", value: 92 },
  { label: "Keywords", value: 78 },
  { label: "Formatting", value: 85 },
];

const TRUST_POINTS = ["No sign-up required", "Instant results", "Privacy-first"];

function Hero() {
  return (
    <section className="hero" id="top">
      <div className="hero__inner container">
        {/* Copy */}
        <div className="hero__content">
          <span className="hero__badge animate-up">
            <span className="hero__badge-dot" />
            AI-powered resume intelligence
          </span>

          <h1 className="hero__title animate-up" style={{ animationDelay: "60ms" }}>
            Land Your Dream Job <br />
            with <span className="hero__title-accent">AI</span>
          </h1>

          <p
            className="hero__subtitle animate-up"
            style={{ animationDelay: "120ms" }}
          >
            Upload your resume and instantly receive ATS Score, Skill Analysis,
            AI Feedback and Resume Improvement Suggestions.
          </p>

          <div
            className="hero__actions animate-up"
            style={{ animationDelay: "180ms" }}
          >
            <Button
              as="a"
              href="#upload"
              icon={<UploadIcon width={19} height={19} />}
            >
              Upload Resume
            </Button>
            <Button
              as="a"
              href="#demo"
              variant="secondary"
              icon={<PlayIcon width={19} height={19} />}
            >
              Watch Demo
            </Button>
          </div>

          <ul
            className="hero__trust animate-up"
            style={{ animationDelay: "240ms", listStyle: "none", padding: 0 }}
          >
            {TRUST_POINTS.map((point) => (
              <li className="hero__trust-item" key={point}>
                <CheckIcon width={16} height={16} style={{ color: "var(--brand-500)" }} />
                {point}
              </li>
            ))}
          </ul>
        </div>

        {/* Visual mockup */}
        <div className="hero__visual">
          <div className="hero__card">
            <div className="hero__card-head">
              <div>
                <div className="hero__card-title">
                  <SparkleIcon
                    width={16}
                    height={16}
                    style={{ verticalAlign: "-3px", marginRight: 6, color: "var(--brand-500)" }}
                  />
                  Resume Analysis
                </div>
                <div className="hero__card-sub">senior-frontend.pdf</div>
              </div>

              <div className="hero__score">
                <div className="hero__score-inner">
                  <span className="hero__score-value">87</span>
                  <span className="hero__score-label">ATS</span>
                </div>
              </div>
            </div>

            <div className="hero__bars">
              {SKILL_BARS.map((bar, i) => (
                <div key={bar.label}>
                  <div className="hero__bar-label">
                    <span>{bar.label}</span>
                    <span>{bar.value}%</span>
                  </div>
                  <div className="hero__bar-track">
                    <div
                      className="hero__bar-fill"
                      style={{
                        width: `${bar.value}%`,
                        animationDelay: `${300 + i * 150}ms`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default Hero;
