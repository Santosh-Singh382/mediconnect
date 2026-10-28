import Badge from './Badge.jsx'

const STATUS_MAP = {
  ACTIVE: { label: 'Active', variant: 'success' },
  INACTIVE: { label: 'Inactive', variant: 'neutral' },
  ENABLED: { label: 'Enabled', variant: 'success' },
  DISABLED: { label: 'Disabled', variant: 'neutral' },
  VERIFIED: { label: 'Verified', variant: 'success' },
  UNVERIFIED: { label: 'Not verified', variant: 'warning' },
  PENDING: { label: 'Pending', variant: 'warning' },
  APPROVED: { label: 'Approved', variant: 'success' },
  REJECTED: { label: 'Rejected', variant: 'danger' },
  PLACED: { label: 'Placed', variant: 'info' },
  CONFIRMED: { label: 'Confirmed', variant: 'primary' },
  PROCESSING: { label: 'Processing', variant: 'warning' },
  READY: { label: 'Ready', variant: 'violet' },
  OUT_FOR_DELIVERY: { label: 'Out for delivery', variant: 'violet' },
  DELIVERED: { label: 'Delivered', variant: 'success' },
  CANCELLED: { label: 'Cancelled', variant: 'neutral' },
  PAID: { label: 'Paid', variant: 'success' },
  FAILED: { label: 'Failed', variant: 'danger' },
}

export default function StatusBadge({
  status,
  label,
  variant,
  dot = false,
  size,
  className,
}) {
  const config = STATUS_MAP[status] || {
    label: status || 'Unknown',
    variant: 'neutral',
  }

  return (
    <Badge
      variant={variant || config.variant}
      size={size}
      dot={dot}
      className={className}
    >
      {label || config.label}
    </Badge>
  )
}
