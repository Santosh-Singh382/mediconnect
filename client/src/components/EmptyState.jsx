export default function EmptyState({
  icon,
  title,
  description,
  action,
  actionLabel = 'Learn more',
  secondaryAction,
  className = '',
  ...props
}) {
  const actionNode =
    typeof action === 'function' ? (
      <button
        type="button"
        onClick={action}
        className="inline-flex h-9 items-center justify-center rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
      >
        {actionLabel}
      </button>
    ) : (
      action
    )

  return (
    <div
      className={`rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center ${className}`}
      {...props}
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
        {icon || (
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-6 w-6"
          >
            <path d="M4 13h4l1.5 3h5L16 13h4" />
            <path d="M5.5 5h13l1.5 8v4a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17v-4l1.5-8Z" />
          </svg>
        )}
      </div>
      {title ? (
        <h3 className="mb-0 mt-4 text-sm font-semibold text-slate-900">{title}</h3>
      ) : null}
      {description ? (
        <p className="mx-auto mb-0 mt-1.5 max-w-md text-sm leading-6 text-slate-500">
          {description}
        </p>
      ) : null}
      {actionNode || secondaryAction ? (
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
          {actionNode}
          {secondaryAction}
        </div>
      ) : null}
    </div>
  )
}
