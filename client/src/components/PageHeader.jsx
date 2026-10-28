export default function PageHeader({
  title,
  description,
  breadcrumb,
  eyebrow,
  action,
  className = '',
}) {
  return (
    <header
      className={`flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        {breadcrumb ? (
          <nav
            aria-label="Breadcrumb"
            className="mb-2 text-xs font-medium text-slate-500"
          >
            {breadcrumb}
          </nav>
        ) : null}
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-blue-600">
            {eyebrow}
          </p>
        ) : null}
        <div className="flex items-center gap-3">
          <span className="hidden h-8 w-1 rounded-full bg-blue-600 sm:block" aria-hidden="true" />
          <h1 className="mb-0 text-2xl font-semibold tracking-tight text-slate-900 sm:text-[28px]">
            {title}
          </h1>
        </div>
        {description ? (
          <p className="mb-0 mt-1.5 max-w-3xl text-sm leading-6 text-slate-500">
            {description}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
          {action}
        </div>
      ) : null}
    </header>
  )
}

export function SectionHeader({
  title,
  description,
  action,
  className = '',
}) {
  return (
    <div
      className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between ${className}`}
    >
      <div className="min-w-0">
        <h2 className="mb-0 text-base font-semibold text-slate-900">{title}</h2>
        {description ? (
          <p className="mb-0 mt-0.5 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {action ? (
        <div className="flex shrink-0 items-center gap-2">{action}</div>
      ) : null}
    </div>
  )
}
