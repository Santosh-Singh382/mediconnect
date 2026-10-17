import { Routes, Route } from 'react-router-dom'
import LandingPage from './pages/LandingPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import RegisterPage from './pages/RegisterPage.jsx'
import AccountPage from './pages/AccountPage.jsx'
import PatientDashboardPage from './pages/PatientDashboardPage.jsx'
import PatientProfilePage from './pages/PatientProfilePage.jsx'
import DoctorDashboardPage from './pages/DoctorDashboardPage.jsx'
import DoctorProfilePage from './pages/DoctorProfilePage.jsx'
import DoctorSearchPage from './pages/DoctorSearchPage.jsx'
import DoctorDetailsPage from './pages/DoctorDetailsPage.jsx'
import BookAppointmentPage from './pages/BookAppointmentPage.jsx'
import MyAppointmentsPage from './pages/MyAppointmentsPage.jsx'
import DoctorAppointmentsPage from './pages/DoctorAppointmentsPage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import VideoConsultationPage from './pages/VideoConsultationPage.jsx'
import AudioConsultationPage from './pages/AudioConsultationPage.jsx'
import MyPrescriptionsPage from './pages/MyPrescriptionsPage.jsx'
import PrescriptionDetailsPage from './pages/PrescriptionDetailsPage.jsx'
import CreatePrescriptionPage from './pages/CreatePrescriptionPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/doctors" element={<DoctorSearchPage />} />
      <Route path="/doctors/:doctorId" element={<DoctorDetailsPage />} />
      <Route
        path="/doctors/:doctorId/book"
        element={
          <ProtectedRoute roles={['PATIENT']}>
            <BookAppointmentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments"
        element={
          <ProtectedRoute roles={['PATIENT']}>
            <MyAppointmentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments/:appointmentId/chat"
        element={
          <ProtectedRoute roles={['PATIENT', 'DOCTOR']}>
            <ChatPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments/:appointmentId/video"
        element={
          <ProtectedRoute roles={['PATIENT', 'DOCTOR']}>
            <VideoConsultationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments/:appointmentId/audio"
        element={
          <ProtectedRoute roles={['PATIENT', 'DOCTOR']}>
            <AudioConsultationPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/appointments"
        element={
          <ProtectedRoute roles={['DOCTOR']}>
            <DoctorAppointmentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/prescriptions"
        element={
          <ProtectedRoute roles={['PATIENT', 'DOCTOR']}>
            <MyPrescriptionsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/prescriptions/:prescriptionId"
        element={
          <ProtectedRoute roles={['PATIENT', 'DOCTOR']}>
            <PrescriptionDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/appointments/:appointmentId/prescription"
        element={
          <ProtectedRoute roles={['DOCTOR']}>
            <CreatePrescriptionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/account"
        element={
          <ProtectedRoute>
            <AccountPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/dashboard"
        element={
          <ProtectedRoute roles={['PATIENT']}>
            <PatientDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/patient/profile"
        element={
          <ProtectedRoute roles={['PATIENT']}>
            <PatientProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/dashboard"
        element={
          <ProtectedRoute roles={['DOCTOR']}>
            <DoctorDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/doctor/profile"
        element={
          <ProtectedRoute roles={['DOCTOR']}>
            <DoctorProfilePage />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}