import AdminIcon from './AdminIcon.jsx'

export default function ErrorState({
  title = 'We could not load this page',
  message = 'Something went wrong. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  className = '',
}) {
  return (
    <div
      role="alert"
      className={`rounded-xl border border-red-200 bg-white px-6 py-8 text-center shadow-sm ${className}`}
    >
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-red-50 text-red-600">
        <AdminIcon name="alert" className="h-5 w-5" />
      </div>
      <h2 className="mb-0 mt-4 text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mx-auto mb-0 mt-1 max-w-md text-sm leading-6 text-slate-500">
        {message}
      </p>
      {onRetry ? (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex h-9 items-center justify-center rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
        >
          <AdminIcon name="refresh" className="mr-2 h-4 w-4" />
          {retryLabel}
        </button>
      ) : null}
    </div>
  )
}
