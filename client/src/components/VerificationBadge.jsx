import {
  VERIFICATION_STYLES,
  verificationLabel,
} from '../lib/adminFormat.js'

export default function VerificationBadge({ status }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        VERIFICATION_STYLES[status] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {verificationLabel(status)}
    </span>
  )
}
