import { Link } from "react-router-dom";
import "../styles/Navbar.css";
import Button from "./Button";
import ThemeToggle from "./ThemeToggle";
import { SparkleIcon, UploadIcon } from "./icons";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#features" },
  { label: "About", href: "#footer" },
];

/*
 * Sticky, translucent navigation bar.
 * Receives theme state from App so the toggle and the rest of the
 * page stay in sync from a single source of truth.
 */
function Navbar({ theme, onToggleTheme }) {
  return (
    <header className="navbar">
      <nav className="navbar__inner container" aria-label="Primary">
        <a className="navbar__brand" href="#top">
          <span className="navbar__logo">
            <SparkleIcon width={18} height={18} />
          </span>
          ResumeAI
        </a>

        <ul className="navbar__links">
          {NAV_LINKS.map((link) => (
            <li key={link.label}>
              <a className="navbar__link" href={link.href}>
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="navbar__actions">
          <ThemeToggle theme={theme} onToggle={onToggleTheme} />
          <Button
            as={Link}
            to="/upload"
            className="navbar__cta"
            icon={<UploadIcon width={18} height={18} />}
          >
            Upload Resume
          </Button>
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
