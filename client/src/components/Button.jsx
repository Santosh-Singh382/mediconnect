const BASE_CLASS =
  'inline-flex items-center justify-center gap-2 rounded-lg border font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50'

const VARIANT_CLASSES = {
  primary:
    'border-transparent bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800',
  secondary:
    'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50 active:bg-slate-100',
  outline:
    'border-slate-300 bg-white text-slate-700 hover:border-slate-400 hover:bg-slate-50 active:bg-slate-100',
  ghost:
    'border-transparent bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200',
  danger:
    'border-transparent bg-red-600 text-white hover:bg-red-700 active:bg-red-800',
  dangerOutline:
    'border-red-200 bg-white text-red-700 hover:border-red-300 hover:bg-red-50 active:bg-red-100',
  success:
    'border-transparent bg-emerald-600 text-white hover:bg-emerald-700 active:bg-emerald-800',
  successOutline:
    'border-emerald-200 bg-white text-emerald-700 hover:border-emerald-300 hover:bg-emerald-50 active:bg-emerald-100',
  link: 'border-transparent bg-transparent p-0 text-blue-600 underline-offset-4 hover:text-blue-700 hover:underline',
}

const SIZE_CLASSES = {
  xs: 'h-8 px-2.5 text-xs',
  sm: 'h-9 px-3 text-sm',
  md: 'h-10 px-4 text-sm',
  lg: 'h-11 px-5 text-sm',
}

export default function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  type = 'button',
  className = '',
  onClick,
  ...props
}) {
  const classes = [
    BASE_CLASS,
    VARIANT_CLASSES[variant] || VARIANT_CLASSES.primary,
    variant === 'link' ? '' : SIZE_CLASSES[size] || SIZE_CLASSES.md,
    fullWidth ? 'w-full' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <button
      type={type}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span
          aria-hidden="true"
          className="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent"
        />
      ) : null}
      {children}
    </button>
  )
}
