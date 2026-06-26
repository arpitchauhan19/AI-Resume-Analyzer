import { useEffect, useState } from "react";
import "../styles/ui.css";

/*
 * Animated circular progress ring used for the ATS score.
 * Pure SVG (no chart library) so it stays light and inherits the
 * brand gradient. The ring animates from 0 → value on mount via
 * stroke-dashoffset.
 *
 * Props:
 *  - value:   0–100 score
 *  - size:    diameter in px (default 180)
 *  - stroke:  ring thickness (default 14)
 *  - caption: small uppercase label under the number (default "ATS Score")
 */
function CircularScore({ value = 0, size = 180, stroke = 14, caption = "ATS Score" }) {
  const clamped = Math.max(0, Math.min(100, value));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  // Start empty, then fill after mount so the transition plays.
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setProgress(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped]);

  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="circular" style={{ width: size, height: size }}>
      <svg className="circular__svg" width={size} height={size}>
        <defs>
          <linearGradient id="circular-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="50%" stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>
        </defs>
        <circle
          className="circular__bg"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
        />
        <circle
          className="circular__bar"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="circular__center">
        <div>
          <div className="circular__value">{clamped}</div>
          <div className="circular__caption">{caption}</div>
        </div>
      </div>
    </div>
  );
}

export default CircularScore;
