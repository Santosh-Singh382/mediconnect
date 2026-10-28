const VARIANT_CLASSES = {
  neutral: 'bg-slate-100 text-slate-700 ring-slate-200',
  primary: 'bg-blue-50 text-blue-700 ring-blue-200',
  secondary: 'bg-slate-50 text-slate-600 ring-slate-200',
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  warning: 'bg-amber-50 text-amber-800 ring-amber-200',
  danger: 'bg-red-50 text-red-700 ring-red-200',
  info: 'bg-sky-50 text-sky-700 ring-sky-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200',
  verified: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  online: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  offline: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-[11px]',
  default: 'px-2.5 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
}

export default function Badge({
  children,
  variant = 'neutral',
  size = 'default',
  dot = false,
  className = '',
  ...props
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-medium ring-1 ring-inset ${
        VARIANT_CLASSES[variant] || VARIANT_CLASSES.neutral
      } ${SIZE_CLASSES[size] || SIZE_CLASSES.default} ${className}`}
      {...props}
    >
      {dot ? (
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 rounded-full bg-current"
        />
      ) : null}
      {children}
    </span>
  )
}
