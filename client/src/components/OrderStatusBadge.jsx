import {
  ORDER_STATUS_STYLES,
  orderStatusLabel,
} from '../lib/orderFormat.js'

export default function OrderStatusBadge({ status }) {
  const style = ORDER_STATUS_STYLES[status] || 'bg-slate-100 text-slate-700'
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}
    >
      {orderStatusLabel(status)}
    </span>
  )
}
