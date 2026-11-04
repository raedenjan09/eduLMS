import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';
import FacultyDashboard from './pages/FacultyDashboard';
import FacultyClassView from './pages/FacultyClassView';
import StudentDashboard from './pages/StudentDashboard';
import StudentClassView from './pages/StudentClassView';
import LessonViewer from './pages/LessonViewer';
import QuizTaker from './pages/QuizTaker';
import AdminDashboard from './pages/AdminDashboard';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-gray-50 text-gray-900">
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Faculty Routes */}
          <Route 
            path="/faculty" 
            element={
              <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                <FacultyDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/faculty/class/:classId" 
            element={
              <ProtectedRoute allowedRoles={['faculty', 'admin']}>
                <FacultyClassView />
              </ProtectedRoute>
            } 
          />

          {/* Student Routes */}
          <Route 
            path="/student" 
            element={
              <ProtectedRoute allowedRoles={['student', 'admin']}>
                <StudentDashboard />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/student/class/:classId" 
            element={
              <ProtectedRoute allowedRoles={['student', 'admin']}>
                <StudentClassView />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/student/lesson/:lessonId" 
            element={
              <ProtectedRoute allowedRoles={['student', 'admin']}>
                <LessonViewer />
              </ProtectedRoute>
            } 
          />
          <Route 
            path="/student/quiz/:quizId" 
            element={
              <ProtectedRoute allowedRoles={['student', 'admin']}>
                <QuizTaker />
              </ProtectedRoute>
            } 
          />

          {/* Admin Routes */}
          <Route 
            path="/admin" 
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminDashboard />
              </ProtectedRoute>
            } 
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
