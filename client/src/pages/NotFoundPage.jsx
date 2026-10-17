import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold uppercase tracking-wider text-brand-600">
        404
      </p>
      <h1 className="mt-3 text-2xl font-semibold text-slate-900">
        We couldn&apos;t find that page
      </h1>
      <p className="mt-2 text-sm text-slate-600">
        The page may have moved or the link is incorrect.
      </p>
      <Link
        to="/"
        className="mt-6 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        Back to home
      </Link>
    </div>
  )
}
