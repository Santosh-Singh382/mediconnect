export default function AdminPagination({
  pagination,
  currentPage,
  onChange,
  label = 'Results pagination',
}) {
  if (!pagination || pagination.totalPages <= 1) {
    return null
  }

  return (
    <nav
      className="mt-6 flex flex-wrap items-center justify-between gap-3"
      aria-label={label}
    >
      <p className="text-sm text-slate-500">
        Showing page {currentPage} of {pagination.totalPages} ({pagination.total}{' '}
        {pagination.total === 1 ? 'result' : 'results'})
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onChange(currentPage - 1)}
          disabled={currentPage <= 1}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={() => onChange(currentPage + 1)}
          disabled={currentPage >= pagination.totalPages}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </nav>
  )
}
