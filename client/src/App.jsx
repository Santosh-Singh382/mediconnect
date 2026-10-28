import { Navigate, Routes, Route } from 'react-router-dom'
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
import MedicineSearchPage from './pages/MedicineSearchPage.jsx'
import MedicineDetailsPage from './pages/MedicineDetailsPage.jsx'
import BookAppointmentPage from './pages/BookAppointmentPage.jsx'
import MyAppointmentsPage from './pages/MyAppointmentsPage.jsx'
import DoctorAppointmentsPage from './pages/DoctorAppointmentsPage.jsx'
import ChatPage from './pages/ChatPage.jsx'
import VideoConsultationPage from './pages/VideoConsultationPage.jsx'
import AudioConsultationPage from './pages/AudioConsultationPage.jsx'
import MyPrescriptionsPage from './pages/MyPrescriptionsPage.jsx'
import PrescriptionDetailsPage from './pages/PrescriptionDetailsPage.jsx'
import CreatePrescriptionPage from './pages/CreatePrescriptionPage.jsx'
import MyMedicalRecordsPage from './pages/MyMedicalRecordsPage.jsx'
import MedicalRecordDetailsPage from './pages/MedicalRecordDetailsPage.jsx'
import CreateMedicalRecordPage from './pages/CreateMedicalRecordPage.jsx'
import UploadMedicalDocumentPage from './pages/UploadMedicalDocumentPage.jsx'
import PharmacyDashboardPage from './pages/PharmacyDashboardPage.jsx'
import PharmacyProfilePage from './pages/PharmacyProfilePage.jsx'
import PharmacyInventoryPage from './pages/PharmacyInventoryPage.jsx'
import PharmacyMedicineFormPage from './pages/PharmacyMedicineFormPage.jsx'
import PharmacyOrdersPage from './pages/PharmacyOrdersPage.jsx'
import PharmacyOrderDetailsPage from './pages/PharmacyOrderDetailsPage.jsx'
import PharmacyCartPage from './pages/PharmacyCartPage.jsx'
import PharmacyCheckoutPage from './pages/PharmacyCheckoutPage.jsx'
import OrderSuccessPage from './pages/OrderSuccessPage.jsx'
import MyOrdersPage from './pages/MyOrdersPage.jsx'
import OrderDetailsPage from './pages/OrderDetailsPage.jsx'
import NotificationsPage from './pages/NotificationsPage.jsx'
import AdminDashboardPage from './pages/AdminDashboardPage.jsx'
import AdminDoctorsPage from './pages/AdminDoctorsPage.jsx'
import AdminPharmaciesPage from './pages/AdminPharmaciesPage.jsx'
import AdminUsersPage from './pages/AdminUsersPage.jsx'
import AdminMedicinesPage from './pages/AdminMedicinesPage.jsx'
import AdminOrdersPage from './pages/AdminOrdersPage.jsx'
import AdminOrderDetailsPage from './pages/AdminOrderDetailsPage.jsx'
import AdminNotificationsPage from './pages/AdminNotificationsPage.jsx'
import NotFoundPage from './pages/NotFoundPage.jsx'
import AdminLayout from './components/AdminLayout.jsx'
import ProtectedRoute from './components/ProtectedRoute.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/doctors" element={<DoctorSearchPage />} />
      <Route path="/doctors/:doctorId" element={<DoctorDetailsPage />} />
      <Route path="/medicines" element={<MedicineSearchPage />} />
      <Route path="/medicines/:medicineId" element={<MedicineDetailsPage />} />
      <Route
        path="/doctors/:doctorId/book"
        element={
          <ProtectedRoute roles={['PATIENT']}>
            <BookAppointmentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/cart"
        element={
          <ProtectedRoute roles={['PATIENT']}>
            <PharmacyCartPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkout/:cartId"
        element={
          <ProtectedRoute roles={['PATIENT']}>
            <PharmacyCheckoutPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute roles={['PATIENT']}>
            <MyOrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:orderId/success"
        element={
          <ProtectedRoute roles={['PATIENT']}>
            <OrderSuccessPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:orderId"
        element={
          <ProtectedRoute roles={['PATIENT']}>
            <OrderDetailsPage />
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
        path="/medical-records"
        element={
          <ProtectedRoute roles={['PATIENT', 'DOCTOR']}>
            <MyMedicalRecordsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medical-records/upload"
        element={
          <ProtectedRoute roles={['PATIENT']}>
            <UploadMedicalDocumentPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/medical-records/:recordId"
        element={
          <ProtectedRoute roles={['PATIENT', 'DOCTOR']}>
            <MedicalRecordDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/appointments/:appointmentId/medical-record/new"
        element={
          <ProtectedRoute roles={['DOCTOR']}>
            <CreateMedicalRecordPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <NotificationsPage />
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
      <Route
        path="/pharmacy/dashboard"
        element={
          <ProtectedRoute roles={['PHARMACY']}>
            <PharmacyDashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/profile"
        element={
          <ProtectedRoute roles={['PHARMACY']}>
            <PharmacyProfilePage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/orders"
        element={
          <ProtectedRoute roles={['PHARMACY']}>
            <PharmacyOrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/orders/:orderId"
        element={
          <ProtectedRoute roles={['PHARMACY']}>
            <PharmacyOrderDetailsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/inventory"
        element={
          <ProtectedRoute roles={['PHARMACY']}>
            <PharmacyInventoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/inventory/new"
        element={
          <ProtectedRoute roles={['PHARMACY']}>
            <PharmacyMedicineFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/pharmacy/inventory/:medicineId/edit"
        element={
          <ProtectedRoute roles={['PHARMACY']}>
            <PharmacyMedicineFormPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin"
        element={
          <ProtectedRoute roles={['ADMIN']}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<AdminDashboardPage />} />
        <Route path="dashboard" element={<Navigate to="/admin" replace />} />
        <Route path="doctors" element={<AdminDoctorsPage />} />
        <Route path="pharmacies" element={<AdminPharmaciesPage />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="medicines" element={<AdminMedicinesPage />} />
        <Route path="orders" element={<AdminOrdersPage />} />
        <Route path="orders/:orderId" element={<AdminOrderDetailsPage />} />
        <Route
          path="notifications"
          element={<AdminNotificationsPage />}
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}