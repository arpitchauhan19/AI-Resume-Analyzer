import { Link } from "react-router-dom";
import "../styles/ui.css";
import useTheme from "../hooks/useTheme";
import ThemeToggle from "./ThemeToggle";
import Button from "./Button";
import { SparkleIcon, HomeIcon } from "./icons";

/*
 * Shared header for the app flow pages (Upload / Loading / Dashboard).
 * Mirrors the landing Navbar visual language (brand mark, theme toggle)
 * but uses react-router <Link> so it navigates between routes instead of
 * anchors. Owns its own theme instance via the existing useTheme hook so
 * the light/dark choice stays in sync through localStorage.
 */
function AppHeader({ showHome = true }) {
  const { theme, toggleTheme } = useTheme();

  return (
    <header className="app-header">
      <div className="app-header__inner container">
        <Link className="app-header__brand" to="/">
          <span className="app-header__logo">
            <SparkleIcon width={18} height={18} />
          </span>
          ResumeAI
        </Link>

        <div className="app-header__actions">
          <ThemeToggle theme={theme} onToggle={toggleTheme} />
          {showHome && (
            <Button
              as={Link}
              to="/"
              variant="secondary"
              icon={<HomeIcon width={18} height={18} />}
            >
              <span className="app-header__home-label">Home</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}

export default AppHeader;
