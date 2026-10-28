import Modal from './Modal.jsx'
import Button from './Button.jsx'
import Badge from './Badge.jsx'
import StatusBadge from './StatusBadge.jsx'
import {
  formatAdminDate,
  ROLE_BADGE_VARIANTS,
  roleLabel,
} from '../lib/adminFormat.js'

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'U'
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

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

export default function AdminUserDetailsModal({ user, onClose }) {
  if (!user) return null

  return (
    <Modal
      open
      onClose={onClose}
      size="lg"
      title="User details"
      description="Account information available to administrators."
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}
    >
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-700">
          {initials(user.name)}
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mb-0 truncate text-base font-semibold text-slate-900">
              {user.name || 'Unnamed user'}
            </h3>
            <Badge variant={ROLE_BADGE_VARIANTS[user.role] || 'neutral'}>
              {roleLabel(user.role)}
            </Badge>
          </div>
          <p className="mb-0 mt-0.5 break-all text-sm text-slate-500">
            {user.email || 'No email address'}
          </p>
        </div>
      </div>

      <dl className="mt-6 grid gap-5 rounded-lg border border-slate-200 bg-slate-50/60 p-4 sm:grid-cols-2">
        <DetailItem label="Phone">{user.phone || 'Not provided'}</DetailItem>
        <DetailItem label="Role">{roleLabel(user.role)}</DetailItem>
        <DetailItem label="Account status">
          <StatusBadge
            status={user.isActive ? 'ACTIVE' : 'INACTIVE'}
            dot
          />
        </DetailItem>
        <DetailItem label="Verification">
          <StatusBadge
            status={user.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
            dot
          />
        </DetailItem>
        <DetailItem label="Joined">
          {formatAdminDate(user.createdAt, { withTime: true }) || '—'}
        </DetailItem>
        <DetailItem label="Last updated">
          {formatAdminDate(user.updatedAt, { withTime: true }) || '—'}
        </DetailItem>
        <DetailItem label="User ID">
          <span className="break-all font-mono text-xs text-slate-600">
            {user.id}
          </span>
        </DetailItem>
      </dl>

      <p className="mb-0 mt-4 text-xs leading-5 text-slate-500">
        Administrators can manage login access from the users table. Roles and
        profile verification are managed through their dedicated workflows.
      </p>
    </Modal>
  )
}
