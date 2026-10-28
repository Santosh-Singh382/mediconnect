export default function LoadingState({ label = 'Loading…', className = '' }) {
  return (
    <div
      role="status"
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-16 ${className}`}
    >
      <span
        aria-hidden="true"
        className="h-7 w-7 animate-spin rounded-full border-[3px] border-slate-200 border-t-blue-600"
      />
      <p className="mb-0 text-sm text-slate-500">{label}</p>
    </div>
  )
}
