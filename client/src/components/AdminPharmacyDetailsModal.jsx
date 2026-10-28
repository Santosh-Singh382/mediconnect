import Modal from './Modal.jsx'
import Button from './Button.jsx'
import Alert from './Alert.jsx'
import StatusBadge from './StatusBadge.jsx'
import VerificationBadge from './VerificationBadge.jsx'
import { formatAdminDate } from '../lib/adminFormat.js'

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

export default function AdminPharmacyDetailsModal({ pharmacy, onClose }) {
  if (!pharmacy) return null

  const address =
    [
      pharmacy.address,
      pharmacy.city,
      pharmacy.state,
      pharmacy.pincode,
    ]
      .filter(Boolean)
      .join(', ') || null

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="Pharmacy details"
      description="Profile and verification information for this pharmacy."
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="mb-0 text-base font-semibold text-slate-900">
            {pharmacy.pharmacyName || 'Unnamed pharmacy'}
          </h3>
          <p className="mb-0 mt-0.5 text-sm text-slate-500">
            {pharmacy.licenseNumber
              ? `Licence ${pharmacy.licenseNumber}`
              : 'Licence number not provided'}
          </p>
        </div>
        <VerificationBadge status={pharmacy.verificationStatus} />
      </div>

      <dl className="mt-5 grid gap-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2">
        <DetailItem label="Pharmacist">
          {pharmacy.pharmacistName || 'Not provided'}
        </DetailItem>
        <DetailItem label="Licence number">
          {pharmacy.licenseNumber || 'Not provided'}
        </DetailItem>
        <DetailItem label="Email">{pharmacy.email || 'Not provided'}</DetailItem>
        <DetailItem label="Phone">{pharmacy.phone || 'Not provided'}</DetailItem>
        <DetailItem label="Address">{address || 'Not provided'}</DetailItem>
        <DetailItem label="Profile status">
          <StatusBadge
            status={pharmacy.isActive ? 'ACTIVE' : 'INACTIVE'}
            dot
          />
        </DetailItem>
        <DetailItem label="Submitted">
          {formatAdminDate(pharmacy.createdAt, { withTime: true }) || '—'}
        </DetailItem>
      </dl>

      {pharmacy.verificationReason ? (
        <Alert variant="danger" title="Rejection reason" className="mt-4">
          <span className="whitespace-pre-wrap">
            {pharmacy.verificationReason}
          </span>
        </Alert>
      ) : null}

      <p className="mb-0 mt-4 text-xs leading-5 text-slate-500">
        Approving a pharmacy makes it visible in the public marketplace.
        Verification changes are reported to the pharmacy.
      </p>
    </Modal>
  )
}
