import { PRESCRIPTION_STATUS_STYLES } from '../lib/prescriptionFormat.js'

export default function PrescriptionStatusBadge({ status }) {
  const style = PRESCRIPTION_STATUS_STYLES[status] || 'bg-slate-100 text-slate-700'
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {status}
    </span>
  )
}
