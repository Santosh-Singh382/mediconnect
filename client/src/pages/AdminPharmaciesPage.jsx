import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import VerificationBadge from '../components/VerificationBadge.jsx'
import AdminPagination from '../components/AdminPagination.jsx'
import {
  getAdminPharmacies,
  updatePharmacyVerification,
} from '../lib/adminApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { formatAdminDate, VERIFICATION_OPTIONS } from '../lib/adminFormat.js'
import { inputClass } from '../lib/formStyles.js'

const PAGE_LIMIT = 20

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
]

function PharmacyDetails({ pharmacy }) {
  const rows = [
    ['Pharmacy', pharmacy.pharmacyName],
    ['Pharmacist', pharmacy.pharmacistName || 'Not provided'],
    ['Licence number', pharmacy.licenseNumber || 'Not provided'],
    ['Email', pharmacy.email || 'Not provided'],
    ['Phone', pharmacy.phone || 'Not provided'],
    [
      'Address',
      [
        pharmacy.address,
        pharmacy.city,
        pharmacy.state,
        pharmacy.pincode,
      ]
        .filter(Boolean)
        .join(', ') || 'Not provided',
    ],
    ['Profile status', pharmacy.isActive ? 'Active' : 'Inactive'],
    ['Submitted', formatAdminDate(pharmacy.createdAt, { withTime: true })],
  ]

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-lg font-semibold text-slate-900">
          {pharmacy.pharmacyName}
        </h2>
        <VerificationBadge status={pharmacy.verificationStatus} />
      </div>
      <dl className="mt-5 grid gap-4 sm:grid-cols-2">
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">
              {label}
            </dt>
            <dd className="mt-1 break-words text-sm text-slate-900">{value}</dd>
          </div>
        ))}
      </dl>
      {pharmacy.verificationReason ? (
        <div className="mt-5 rounded-md border border-red-200 bg-red-50 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
            Rejection reason
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-red-800">
            {pharmacy.verificationReason}
          </p>
        </div>
      ) : null}
    </div>
  )
}

function PharmacyActionDialog({
  pharmacy,
  action,
  submitting,
  error,
  onClose,
  onConfirm,
}) {
  const [reason, setReason] = useState('')
  const isReject = action === 'REJECTED'
  const canSubmit = !submitting && (!isReject || reason.trim().length > 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pharmacy-action-title"
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl sm:p-6"
      >
        <h2
          id="pharmacy-action-title"
          className="text-lg font-semibold text-slate-900"
        >
          {isReject ? 'Reject pharmacy profile' : 'Approve pharmacy profile'}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {isReject
            ? `Provide a reason for rejecting ${pharmacy.pharmacyName}. The pharmacy will be notified.`
            : `Approve ${pharmacy.pharmacyName}? The pharmacy will become visible in the public directory.`}
        </p>

        {isReject ? (
          <div className="mt-4">
            <label
              htmlFor="pharmacy-rejection-reason"
              className="block text-sm font-medium text-slate-700"
            >
              Rejection reason
            </label>
            <textarea
              id="pharmacy-rejection-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              rows={4}
              maxLength={500}
              required
              className={inputClass}
            />
            <p className="mt-1 text-xs text-slate-500">
              {reason.trim().length}/500 characters
            </p>
          </div>
        ) : null}

        {error ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}

        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(isReject ? reason.trim() : null)}
            disabled={!canSubmit}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              isReject
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {submitting
              ? 'Saving…'
              : isReject
                ? 'Reject pharmacy'
                : 'Approve pharmacy'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPharmaciesPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState({
    q: searchParams.get('q') || '',
    status: searchParams.get('status') || '',
    sort: searchParams.get('sort') || 'newest',
  })
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })
  const [viewing, setViewing] = useState(null)
  const [actionState, setActionState] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [notice, setNotice] = useState(null)

  const load = useCallback(
    ({ showLoading = true } = {}) => {
      if (showLoading) {
        setState({ loading: true, error: null, data: null })
      }
      const params = {
        limit: PAGE_LIMIT,
        sort: searchParams.get('sort') || 'newest',
      }
      const q = searchParams.get('q')
      const status = searchParams.get('status')
      const page = searchParams.get('page')
      if (q) params.q = q
      if (status) params.status = status
      if (page) params.page = page

      return getAdminPharmacies(params)
        .then((response) => {
          setState({
            loading: false,
            error: null,
            data: response.data.data,
          })
        })
        .catch((error) => {
          setState({
            loading: false,
            error: getApiErrorMessage(
              error,
              'Unable to load pharmacy profiles right now.',
            ),
            data: null,
          })
        })
    },
    [searchParams],
  )

  useEffect(() => {
    setDraft({
      q: searchParams.get('q') || '',
      status: searchParams.get('status') || '',
      sort: searchParams.get('sort') || 'newest',
    })
  }, [searchParams])

  useEffect(() => {
    load()
  }, [load])

  function handleApply(event) {
    event.preventDefault()
    const next = new URLSearchParams()
    const q = draft.q.trim()
    if (q) next.set('q', q)
    if (draft.status) next.set('status', draft.status)
    if (draft.sort && draft.sort !== 'newest') next.set('sort', draft.sort)
    setSearchParams(next)
  }

  function handleClear() {
    setDraft({ q: '', status: '', sort: 'newest' })
    setSearchParams({})
  }

  function changePage(page) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }

  async function confirmAction(reason) {
    if (!actionState) return
    setSubmitting(true)
    setActionError(null)
    try {
      await updatePharmacyVerification(actionState.pharmacy.id, {
        status: actionState.action,
        ...(reason ? { reason } : {}),
      })
      const verb =
        actionState.action === 'APPROVED' ? 'approved' : 'rejected'
      setNotice(`${actionState.pharmacy.pharmacyName} was ${verb}.`)
      setActionState(null)
      await load({ showLoading: false })
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          'Unable to update this pharmacy profile right now.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const hasFilters = Boolean(
    searchParams.get('q') ||
      searchParams.get('status') ||
      (searchParams.get('sort') && searchParams.get('sort') !== 'newest'),
  )
  const currentPage = Number(searchParams.get('page')) || 1
  const pharmacies = state.data?.pharmacies || []
  const pagination = state.data?.pagination || null

  function actionsFor(pharmacy) {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setViewing(pharmacy)}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50"
        >
          View
        </button>
        {pharmacy.verificationStatus !== 'APPROVED' ? (
          <button
            type="button"
            onClick={() => {
              setActionError(null)
              setActionState({ pharmacy, action: 'APPROVED' })
            }}
            className="rounded-md bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-green-700"
          >
            Approve
          </button>
        ) : null}
        {pharmacy.verificationStatus !== 'REJECTED' ? (
          <button
            type="button"
            onClick={() => {
              setActionError(null)
              setActionState({ pharmacy, action: 'REJECTED' })
            }}
            className="rounded-md bg-red-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-red-700"
          >
            Reject
          </button>
        ) : null}
      </div>
    )
  }

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          Pharmacy verification
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Review pharmacy profiles and control marketplace visibility.
        </p>
      </header>

      {notice ? (
        <p
          role="status"
          className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800"
        >
          {notice}
        </p>
      ) : null}

      <form
        onSubmit={handleApply}
        className="mt-6 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      >
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label
              htmlFor="admin-pharmacy-search"
              className="block text-sm font-medium text-slate-700"
            >
              Search
            </label>
            <input
              id="admin-pharmacy-search"
              type="search"
              value={draft.q}
              onChange={(event) =>
                setDraft((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Name, pharmacist, licence, email, or city"
              maxLength={100}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="admin-pharmacy-status"
              className="block text-sm font-medium text-slate-700"
            >
              Verification
            </label>
            <select
              id="admin-pharmacy-status"
              value={draft.status}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  status: event.target.value,
                }))
              }
              className={inputClass}
            >
              {VERIFICATION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="admin-pharmacy-sort"
              className="block text-sm font-medium text-slate-700"
            >
              Sort by
            </label>
            <select
              id="admin-pharmacy-sort"
              value={draft.sort}
              onChange={(event) =>
                setDraft((current) => ({ ...current, sort: event.target.value }))
              }
              className={inputClass}
            >
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="submit"
            className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
          >
            Apply filters
          </button>
          {hasFilters ? (
            <button
              type="button"
              onClick={handleClear}
              className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Clear filters
            </button>
          ) : null}
        </div>
      </form>

      {state.loading ? (
        <div className="mt-8">
          <LoadingState label="Loading pharmacy profiles…" />
        </div>
      ) : state.error ? (
        <div className="mt-8">
          <ErrorState message={state.error} onRetry={() => load()} />
        </div>
      ) : pharmacies.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            No pharmacy profiles found
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Try changing the search or verification filters.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    'Pharmacy',
                    'Location',
                    'Verification',
                    'Profile',
                    'Submitted',
                    'Actions',
                  ].map((label) => (
                    <th
                      key={label}
                      scope="col"
                      className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pharmacies.map((pharmacy) => (
                  <tr key={pharmacy.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {pharmacy.pharmacyName}
                      </p>
                      <p className="mt-0.5 break-all text-xs text-slate-500">
                        {pharmacy.email || 'No email'}
                      </p>
                      <p className="text-xs text-slate-500">
                        {pharmacy.licenseNumber || 'No licence'}
                      </p>
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {[pharmacy.city, pharmacy.state]
                        .filter(Boolean)
                        .join(', ') || 'Not provided'}
                    </td>
                    <td className="px-4 py-4">
                      <VerificationBadge status={pharmacy.verificationStatus} />
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span
                        className={
                          pharmacy.isActive
                            ? 'text-green-700'
                            : 'text-slate-500'
                        }
                      >
                        {pharmacy.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {formatAdminDate(pharmacy.createdAt)}
                    </td>
                    <td className="px-4 py-4">{actionsFor(pharmacy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-3 md:hidden">
            {pharmacies.map((pharmacy) => (
              <article
                key={pharmacy.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {pharmacy.pharmacyName}
                    </h2>
                    <p className="break-all text-xs text-slate-500">
                      {pharmacy.email || 'No email'}
                    </p>
                  </div>
                  <VerificationBadge status={pharmacy.verificationStatus} />
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <dt className="text-slate-500">Location</dt>
                    <dd className="font-medium text-slate-800">
                      {[pharmacy.city, pharmacy.state]
                        .filter(Boolean)
                        .join(', ') || 'Not provided'}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-500">Profile</dt>
                    <dd className="font-medium text-slate-800">
                      {pharmacy.isActive ? 'Active' : 'Inactive'}
                    </dd>
                  </div>
                </dl>
                <div className="mt-3">{actionsFor(pharmacy)}</div>
              </article>
            ))}
          </div>

          <AdminPagination
            pagination={pagination}
            currentPage={currentPage}
            onChange={changePage}
            label="Pharmacy pagination"
          />
        </>
      )}

      {viewing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pharmacy-details-title"
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg bg-white p-5 shadow-xl sm:p-6"
          >
            <h2 id="pharmacy-details-title" className="sr-only">
              Pharmacy profile details
            </h2>
            <PharmacyDetails pharmacy={viewing} />
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setViewing(null)}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {actionState ? (
        <PharmacyActionDialog
          key={`${actionState.pharmacy.id}-${actionState.action}`}
          pharmacy={actionState.pharmacy}
          action={actionState.action}
          submitting={submitting}
          error={actionError}
          onClose={() => {
            if (!submitting) {
              setActionState(null)
              setActionError(null)
            }
          }}
          onConfirm={confirmAction}
        />
      ) : null}
    </div>
  )
}
