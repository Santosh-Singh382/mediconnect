import { Link } from 'react-router-dom'
import { pharmacyOrderAccessState } from '../lib/pharmacyOrderAccess.js'

export default function PharmacyOrderAccessNotice({ code }) {
  const state = pharmacyOrderAccessState(code)
  if (!state) return null

  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-8 text-center">
      <h2 className="text-base font-semibold text-amber-900">{state.title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-amber-800">
        {state.message}
      </p>
      <Link
        to="/pharmacy/profile"
        className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
      >
        {state.action}
      </Link>
    </div>
  )
}
