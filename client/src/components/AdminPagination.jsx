import AdminIcon from './AdminIcon.jsx'

export default function AdminPagination({
  pagination,
  currentPage,
  onChange,
  label = 'Results pagination',
}) {
  if (!pagination || pagination.totalPages <= 1) {
    return null
  }

  const total = pagination.total ?? 0
  const limit = pagination.limit ?? 0
  const start = limit > 0 ? (currentPage - 1) * limit + 1 : 0
  const end = limit > 0 ? Math.min(currentPage * limit, total) : total

  return (
    <nav
      className="flex flex-col items-start justify-between gap-3 border-t border-slate-200 px-4 py-3 sm:flex-row sm:items-center"
      aria-label={label}
    >
      <p className="mb-0 text-xs text-slate-500">
        Showing <span className="font-semibold text-slate-700">{start}</span>–
        <span className="font-semibold text-slate-700">{end}</span> of{' '}
        <span className="font-semibold text-slate-700">{total}</span>{' '}
        {total === 1 ? 'result' : 'results'}
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <AdminIcon name="chevronRight" className="h-3.5 w-3.5 rotate-180" />
          Previous
        </button>
        <span className="px-1 text-xs font-medium text-slate-500">
          Page {currentPage} of {pagination.totalPages}
        </span>
        <button
          type="button"
          onClick={() => onChange(currentPage + 1)}
          disabled={currentPage >= pagination.totalPages}
          className="inline-flex h-8 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next
          <AdminIcon name="chevronRight" className="h-3.5 w-3.5" />
        </button>
      </div>
    </nav>
  )
}
