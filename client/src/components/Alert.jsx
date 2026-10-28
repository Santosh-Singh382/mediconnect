import AdminIcon from './AdminIcon.jsx'

const VARIANT_CLASSES = {
  info: {
    wrapper: 'border-sky-200 bg-sky-50 text-sky-900',
    icon: 'text-sky-600',
    name: 'alert',
  },
  success: {
    wrapper: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    icon: 'text-emerald-600',
    name: 'shield',
  },
  warning: {
    wrapper: 'border-amber-200 bg-amber-50 text-amber-900',
    icon: 'text-amber-600',
    name: 'alert',
  },
  danger: {
    wrapper: 'border-red-200 bg-red-50 text-red-900',
    icon: 'text-red-600',
    name: 'alert',
  },
}

export default function Alert({
  variant = 'info',
  title,
  children,
  action,
  onDismiss,
  className = '',
}) {
  const config = VARIANT_CLASSES[variant] || VARIANT_CLASSES.info
  const isUrgent = variant === 'danger' || variant === 'warning'

  return (
    <div
      role={isUrgent ? 'alert' : 'status'}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${config.wrapper} ${className}`}
    >
      <AdminIcon
        name={config.name}
        className={`mt-0.5 h-5 w-5 shrink-0 ${config.icon}`}
      />
      <div className="min-w-0 flex-1">
        {title ? <p className="mb-0 font-semibold">{title}</p> : null}
        {children ? (
          <div className={title ? 'mt-1 leading-5' : 'leading-5'}>
            {children}
          </div>
        ) : null}
        {action ? <div className="mt-2">{action}</div> : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="-mr-1 -mt-1 rounded-md p-1 text-current opacity-70 transition hover:bg-black/5 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current"
          aria-label="Dismiss alert"
        >
          <AdminIcon name="close" className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  )
}
