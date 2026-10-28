import Modal from './Modal.jsx'
import Button from './Button.jsx'
import Alert from './Alert.jsx'
import StatusBadge from './StatusBadge.jsx'
import VerificationBadge from './VerificationBadge.jsx'
import { formatAdminDate } from '../lib/adminFormat.js'
import { formatMedicinePrice } from '../lib/medicineFormat.js'

function DetailItem({ label, children }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm text-slate-900">{children}</dd>
    </div>
  )
}

export default function AdminDoctorDetailsModal({ doctor, onClose }) {
  if (!doctor) return null

  const location =
    [doctor.clinicCity, doctor.clinicState].filter(Boolean).join(', ') || null

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Doctor details"
      description="Profile and verification information for this doctor."
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="mb-0 text-base font-semibold text-slate-900">
            {doctor.name || 'Unnamed doctor'}
          </h3>
          <p className="mb-0 mt-0.5 text-sm text-slate-500">
            {doctor.specialization || 'Specialization not provided'}
          </p>
        </div>
        <VerificationBadge status={doctor.verificationStatus} />
      </div>

      <dl className="mt-5 grid gap-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2">
        <DetailItem label="Email">{doctor.email || 'Not provided'}</DetailItem>
        <DetailItem label="Phone">{doctor.phone || 'Not provided'}</DetailItem>
        <DetailItem label="Qualification">
          {doctor.qualification || 'Not provided'}
        </DetailItem>
        <DetailItem label="Experience">
          {typeof doctor.experience === 'number'
            ? `${doctor.experience} years`
            : 'Not provided'}
        </DetailItem>
        <DetailItem label="Registration number">
          {doctor.registrationNumber || 'Not provided'}
        </DetailItem>
        <DetailItem label="Consultation fee">
          {typeof doctor.consultationFee === 'number'
            ? formatMedicinePrice(doctor.consultationFee)
            : 'Not provided'}
        </DetailItem>
        <DetailItem label="Clinic">
          {doctor.clinicName || 'Not provided'}
        </DetailItem>
        <DetailItem label="Clinic location">
          {location || 'Not provided'}
        </DetailItem>
        <DetailItem label="Account status">
          <StatusBadge
            status={doctor.isActive ? 'ACTIVE' : 'INACTIVE'}
            dot
          />
        </DetailItem>
        <DetailItem label="Submitted">
          {formatAdminDate(doctor.createdAt, { withTime: true }) || '—'}
        </DetailItem>
      </dl>

      {doctor.verificationReason ? (
        <Alert variant="danger" title="Rejection reason" className="mt-4">
          <span className="whitespace-pre-wrap">
            {doctor.verificationReason}
          </span>
        </Alert>
      ) : null}

      <p className="mb-0 mt-4 text-xs leading-5 text-slate-500">
        Approving a doctor makes the profile visible in the public doctor
        directory. Verification changes are reported to the doctor.
      </p>
    </Modal>
  )
}
