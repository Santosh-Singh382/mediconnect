import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Select from '../components/Select.jsx'
import Table from '../components/Table.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import VerificationBadge from '../components/VerificationBadge.jsx'
import Alert from '../components/Alert.jsx'
import AdminPagination from '../components/AdminPagination.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import AdminIcon from '../components/AdminIcon.jsx'
import AdminPharmacyDetailsModal from '../components/AdminPharmacyDetailsModal.jsx'
import AdminVerificationDialog from '../components/AdminVerificationDialog.jsx'
import {
  getAdminPharmacies,
  updatePharmacyVerification,
} from '../lib/adminApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  ADMIN_SORT_OPTIONS,
  formatAdminDate,
  VERIFICATION_OPTIONS,
} from '../lib/adminFormat.js'

const PAGE_LIMIT = 20

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'P'
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

const COLUMNS = [
  {
    key: 'pharmacy',
    header: 'Pharmacy',
    render: (pharmacy) => (
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-xs font-semibold text-emerald-700">
          {initials(pharmacy.pharmacyName)}
        </span>
        <div className="min-w-0">
          <p className="mb-0 truncate font-medium text-slate-900">
            {pharmacy.pharmacyName || 'Unnamed pharmacy'}
          </p>
          <p className="mb-0 mt-0.5 truncate text-xs text-slate-500">
            {pharmacy.email || 'No email'}
          </p>
        </div>
      </div>
    ),
  },
  {
    key: 'location',
    header: 'Location',
    render: (pharmacy) =>
      [pharmacy.city, pharmacy.state].filter(Boolean).join(', ') || (
        <span className="text-slate-400">Not provided</span>
      ),
  },
  {
    key: 'licenseNumber',
    header: 'Licence',
    render: (pharmacy) => (
      <span className="font-mono text-xs text-slate-600">
        {pharmacy.licenseNumber || '—'}
      </span>
    ),
  },
  {
    key: 'verificationStatus',
    header: 'Verification',
    render: (pharmacy) => (
      <VerificationBadge status={pharmacy.verificationStatus} />
    ),
  },
  {
    key: 'isActive',
    header: 'Profile',
    render: (pharmacy) => (
      <StatusBadge
        status={pharmacy.isActive ? 'ACTIVE' : 'INACTIVE'}
        dot
      />
    ),
  },
  {
    key: 'createdAt',
    header: 'Submitted',
    noWrap: true,
    render: (pharmacy) => (
      <span className="text-slate-600">
        {formatAdminDate(pharmacy.createdAt) || '—'}
      </span>
    ),
  },
]

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
  const requestVersion = useRef(0)

  const load = useCallback(
    ({ showLoading = true } = {}) => {
      requestVersion.current += 1
      const version = requestVersion.current

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
          if (requestVersion.current !== version) return
          setState({
            loading: false,
            error: null,
            data: response.data.data,
          })
        })
        .catch((error) => {
          if (requestVersion.current !== version) return
          setState((current) => ({
            loading: false,
            error: getApiErrorMessage(
              error,
              'Unable to load pharmacy profiles right now.',
            ),
            data: showLoading ? null : current.data,
          }))
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
    return () => {
      requestVersion.current += 1
    }
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

  function beginAction(pharmacy, action) {
    setActionError(null)
    setActionState({ pharmacy, action })
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

  function renderActions(pharmacy) {
    return (
      <div className="flex items-center justify-end gap-1.5">
        <Button
          size="xs"
          variant="secondary"
          onClick={() => setViewing(pharmacy)}
        >
          View
        </Button>
        {pharmacy.verificationStatus !== 'APPROVED' ? (
          <Button
            size="xs"
            variant="successOutline"
            onClick={() => beginAction(pharmacy, 'APPROVED')}
          >
            Approve
          </Button>
        ) : null}
        {pharmacy.verificationStatus !== 'REJECTED' ? (
          <Button
            size="xs"
            variant="dangerOutline"
            onClick={() => beginAction(pharmacy, 'REJECTED')}
          >
            Reject
          </Button>
        ) : null}
      </div>
    )
  }

  const columns = [
    ...COLUMNS,
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: renderActions,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Pharmacies"
        description="Verify pharmacy profiles and control marketplace visibility."
        action={
          <Button
            variant="secondary"
            onClick={() => load()}
            disabled={state.loading}
          >
            <AdminIcon name="refresh" className="h-4 w-4" />
            Refresh
          </Button>
        }
      />

      {notice ? (
        <Alert
          variant="success"
          className="mt-4"
          onDismiss={() => setNotice(null)}
        >
          {notice}
        </Alert>
      ) : null}

      <form
        onSubmit={handleApply}
        className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
      >
        <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-3 sm:px-5">
          <AdminIcon name="filter" className="h-4 w-4 text-slate-400" />
          <h2 className="mb-0 text-sm font-semibold text-slate-900">Filters</h2>
          {hasFilters ? (
            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
              Active
            </span>
          ) : null}
        </div>
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-4">
          <Input
            type="search"
            label="Search"
            containerClassName="sm:col-span-2"
            value={draft.q}
            onChange={(event) =>
              setDraft((current) => ({ ...current, q: event.target.value }))
            }
            placeholder="Name, pharmacist, licence, email, or city"
            maxLength={100}
            leadingIcon={<AdminIcon name="search" className="h-4 w-4" />}
          />
          <Select
            label="Verification"
            value={draft.status}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                status: event.target.value,
              }))
            }
            options={VERIFICATION_OPTIONS}
          />
          <Select
            label="Sort by"
            value={draft.sort}
            onChange={(event) =>
              setDraft((current) => ({ ...current, sort: event.target.value }))
            }
            options={ADMIN_SORT_OPTIONS}
          />
        </div>
        <div className="flex flex-col-reverse gap-2 border-t border-slate-100 bg-slate-50/70 px-4 py-3 sm:flex-row sm:justify-end sm:px-5">
          <Button variant="secondary" onClick={handleClear} disabled={!hasFilters}>
            Clear filters
          </Button>
          <Button type="submit">Apply filters</Button>
        </div>
      </form>

      {state.loading && !state.data ? (
        <div className="mt-6">
          <LoadingState label="Loading pharmacy profiles…" />
        </div>
      ) : state.error && !state.data ? (
        <div className="mt-6">
          <ErrorState message={state.error} onRetry={() => load()} />
        </div>
      ) : (
        <>
          {state.error ? (
            <Alert
              variant="danger"
              className="mt-4"
              action={
                <Button size="xs" variant="secondary" onClick={() => load()}>
                  Try again
                </Button>
              }
            >
              {state.error}
            </Alert>
          ) : null}

          {pharmacies.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No pharmacy profiles found"
                description="Try changing the search or verification filters."
                action={
                  hasFilters ? (
                    <Button variant="secondary" onClick={handleClear}>
                      Clear filters
                    </Button>
                  ) : null
                }
              />
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 sm:px-5">
                <div>
                  <h2 className="mb-0 text-sm font-semibold text-slate-900">
                    Pharmacy profiles
                  </h2>
                  <p className="mb-0 mt-0.5 text-xs text-slate-500">
                    {pagination?.total ?? pharmacies.length}{' '}
                    {pagination?.total === 1 ? 'profile' : 'profiles'}
                  </p>
                </div>
                <Link
                  to="/admin/pharmacies?status=PENDING"
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  Pending only
                  <AdminIcon name="arrowRight" className="h-3.5 w-3.5" />
                </Link>
              </div>
              <Table
                columns={columns}
                data={pharmacies}
                rowKey="id"
                minWidthClass="min-w-[940px]"
                caption="Pharmacy profiles"
              />
              <AdminPagination
                pagination={pagination}
                currentPage={currentPage}
                onChange={changePage}
                label="Pharmacy pagination"
              />
            </div>
          )}
        </>
      )}

      {viewing ? (
        <AdminPharmacyDetailsModal
          pharmacy={viewing}
          onClose={() => setViewing(null)}
        />
      ) : null}

      {actionState ? (
        <AdminVerificationDialog
          key={`${actionState.pharmacy.id}-${actionState.action}`}
          subject="PHARMACY"
          name={actionState.pharmacy.pharmacyName}
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
