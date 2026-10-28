import StatusBadge from './StatusBadge.jsx'
import { verificationLabel } from '../lib/adminFormat.js'

export default function VerificationBadge({ status, dot = true, size }) {
  return (
    <StatusBadge
      status={status}
      label={verificationLabel(status)}
      dot={dot}
      size={size}
    />
  )
}
