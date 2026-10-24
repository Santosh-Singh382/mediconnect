import {
  PAYMENT_STATUS_STYLES,
  paymentStatusLabel,
} from '../lib/orderFormat.js'

export default function PaymentStatusBadge({ status }) {
  const style = PAYMENT_STATUS_STYLES[status] || 'bg-slate-100 text-slate-700'
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {paymentStatusLabel(status)}
    </span>
  )
}
