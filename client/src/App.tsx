
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
} from "react-router-dom";

import LandingPage from "./pages/LandingPage";
import LoginPage from "./pages/LoginPage";
import RoadmapPage from "./pages/RoadmapPage";
import AdminDashboard from "./pages/AdminDashboard";
import AdminRoute from "./AdminRoute";
import ProtectedRoute from "./ProtectedRoute";
import FeedbackBoard from "./FeedbackBoard";
import { ThemeProvider } from "./ThemeContext";

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />

          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<FeedbackBoard />} />
          </Route>

          <Route
            path="/admin"
            element={
              <AdminRoute>
                <AdminDashboard />
              </AdminRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
