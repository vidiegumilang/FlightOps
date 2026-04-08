import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Toaster } from './components/ui/sonner';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import ScheduleBoard from './pages/ScheduleBoard';
import Instructors from './pages/Instructors';
import Students from './pages/Students';
import Aircraft from './pages/Aircraft';
import Stages from './pages/Stages';
import Courses from './pages/Courses';
import FlightNotes from './pages/FlightNotes';
import Announcements from './pages/Announcements';
import ProgressTracker from './pages/ProgressTracker';
import ELearning from './pages/ELearning';
import RecapOER from './pages/RecapOER';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/schedules" element={<ProtectedRoute><ScheduleBoard /></ProtectedRoute>} />
          <Route path="/instructors" element={<ProtectedRoute><Instructors /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute><Students /></ProtectedRoute>} />
          <Route path="/aircraft" element={<ProtectedRoute><Aircraft /></ProtectedRoute>} />
          <Route path="/stages" element={<ProtectedRoute><Stages /></ProtectedRoute>} />
          <Route path="/courses" element={<ProtectedRoute><Courses /></ProtectedRoute>} />
          <Route path="/flight-notes" element={<ProtectedRoute><FlightNotes /></ProtectedRoute>} />
          <Route path="/announcements" element={<ProtectedRoute><Announcements /></ProtectedRoute>} />
          <Route path="/progress" element={<ProtectedRoute><ProgressTracker /></ProtectedRoute>} />
          <Route path="/e-learning" element={<ProtectedRoute><ELearning /></ProtectedRoute>} />
          <Route path="/recap" element={<ProtectedRoute><RecapOER /></ProtectedRoute>} />
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        <Toaster position="top-right" />
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
