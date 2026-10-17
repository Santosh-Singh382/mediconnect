export default function LoadingState({ label = 'Loading…' }) {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm text-slate-500">{label}</p>
    </div>
  )
}