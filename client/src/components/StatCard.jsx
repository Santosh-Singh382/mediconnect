export default function StatCard({
  title,
  value,
  description,
  icon,
  iconClassName = 'bg-slate-100 text-slate-600',
  trend,
  trendClassName = 'text-emerald-600',
  className = '',
  ...props
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)] ${className}`}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mb-0 text-sm font-medium text-slate-500">{title}</p>
          <p className="mb-0 mt-2 text-2xl font-semibold tracking-tight text-slate-900 tabular-nums">
            {value}
          </p>
        </div>
        {icon ? (
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
          >
            {icon}
          </span>
        ) : null}
      </div>
      {description ? (
        <p className="mb-0 mt-3 text-xs leading-5 text-slate-500">{description}</p>
      ) : null}
      {trend ? (
        <p className={`mb-0 mt-1 text-xs font-medium ${trendClassName}`}>{trend}</p>
      ) : null}
    </div>
  )
}
