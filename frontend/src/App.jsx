import { Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import UploadResume from "./pages/UploadResume";
import LoadingAnalysis from "./pages/LoadingAnalysis";
import Dashboard from "./pages/Dashboard";

/*
 * Application route map.
 *  /          → Landing page (untouched)
 *  /upload    → Resume upload flow
 *  /loading   → Fake analysis animation
 *  /dashboard → Results dashboard (fake data)
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
