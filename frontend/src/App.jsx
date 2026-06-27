import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import UploadResume from "./pages/UploadResume";
import LoadingAnalysis from "./pages/LoadingAnalysis";
import Dashboard from "./pages/Dashboard";

/*
 * Application route map.
 *  /          → Landing page (untouched)
 *  /upload    → Resume upload flow (uploads to POST /api/upload)
 *  /loading   → Standalone analysis animation (no longer in the main flow;
 *               real progress is now shown inline on the upload page)
 *  /dashboard → Results dashboard (renders the real parsed resume)
 */
function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/upload" element={<UploadResume />} />
      <Route path="/loading" element={<LoadingAnalysis />} />
      <Route path="/dashboard" element={<Dashboard />} />
    </Routes>
  );
}

export default App;
