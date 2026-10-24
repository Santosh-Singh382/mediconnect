import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import AdminPagination from '../components/AdminPagination.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { getAdminUsers, updateAdminUserStatus } from '../lib/adminApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatAdminDate,
  ROLE_OPTIONS,
  ROLE_STYLES,
  roleLabel,
} from '../lib/adminFormat.js'
import { inputClass } from '../lib/formStyles.js'

const PAGE_LIMIT = 20

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'oldest', label: 'Oldest first' },
  { value: 'name_asc', label: 'Name A–Z' },
  { value: 'name_desc', label: 'Name Z–A' },
]

const BOOLEAN_OPTIONS = [
  { value: '', label: 'Any' },
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
]

function RoleBadge({ role }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        ROLE_STYLES[role] || 'bg-slate-100 text-slate-700'
      }`}
    >
      {roleLabel(role)}
    </span>
  )
}

function AccountStatus({ isActive }) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
        isActive
          ? 'bg-green-100 text-green-800'
          : 'bg-slate-200 text-slate-700'
      }`}
    >
      {isActive ? 'Active' : 'Inactive'}
    </span>
  )
}

function StatusDialog({ user, submitting, error, onClose, onConfirm }) {
  const deactivating = user.isActive

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="user-status-title"
        className="w-full max-w-lg rounded-lg bg-white p-5 shadow-xl sm:p-6"
      >
        <h2
          id="user-status-title"
          className="text-lg font-semibold text-slate-900"
        >
          {deactivating ? 'Deactivate account' : 'Reactivate account'}
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          {deactivating
            ? `Deactivate ${user.name}? They will be signed out of protected actions and unable to log in. Their role and verification status will not change.`
            : `Reactivate ${user.name}? They will be able to log in again with their existing role and verification status.`}
        </p>
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
            onClick={onConfirm}
            disabled={submitting}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
              deactivating
                ? 'bg-red-600 hover:bg-red-700'
                : 'bg-brand-600 hover:bg-brand-700'
            }`}
          >
            {submitting
              ? 'Saving…'
              : deactivating
                ? 'Deactivate account'
                : 'Reactivate account'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminUsersPage() {
  const { user: currentUser } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [draft, setDraft] = useState({
    q: searchParams.get('q') || '',
    role: searchParams.get('role') || '',
    isActive: searchParams.get('isActive') || '',
    isVerified: searchParams.get('isVerified') || '',
    sort: searchParams.get('sort') || 'newest',
  })
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })
  const [statusTarget, setStatusTarget] = useState(null)
  const [statusError, setStatusError] = useState(null)
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
      for (const key of ['q', 'role', 'isActive', 'isVerified', 'page']) {
        const value = searchParams.get(key)
        if (value) params[key] = value
      }

      return getAdminUsers(params)
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
              'Unable to load user accounts right now.',
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
      role: searchParams.get('role') || '',
      isActive: searchParams.get('isActive') || '',
      isVerified: searchParams.get('isVerified') || '',
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
    for (const key of ['role', 'isActive', 'isVerified']) {
      if (draft[key]) next.set(key, draft[key])
    }
    if (draft.sort && draft.sort !== 'newest') next.set('sort', draft.sort)
    setSearchParams(next)
  }

  function handleClear() {
    setDraft({
      q: '',
      role: '',
      isActive: '',
      isVerified: '',
      sort: 'newest',
    })
    setSearchParams({})
  }

  function changePage(page) {
    const next = new URLSearchParams(searchParams)
    next.set('page', String(page))
    setSearchParams(next)
  }

  async function confirmStatusChange() {
    if (!statusTarget) return
    setSubmitting(true)
    setStatusError(null)
    try {
      const nextActive = !statusTarget.isActive
      await updateAdminUserStatus(statusTarget.id, nextActive)
      setNotice(
        `${statusTarget.name} was ${
          nextActive ? 'reactivated' : 'deactivated'
        }.`,
      )
      setStatusTarget(null)
      await load({ showLoading: false })
    } catch (error) {
      setStatusError(
        getApiErrorMessage(
          error,
          'Unable to update this account status right now.',
        ),
      )
    } finally {
      setSubmitting(false)
    }
  }

  const hasFilters = Boolean(
    searchParams.get('q') ||
      searchParams.get('role') ||
      searchParams.get('isActive') ||
      searchParams.get('isVerified') ||
      (searchParams.get('sort') && searchParams.get('sort') !== 'newest'),
  )
  const currentPage = Number(searchParams.get('page')) || 1
  const users = state.data?.users || []
  const pagination = state.data?.pagination || null

  function statusAction(user) {
    if (user.id === currentUser?.id) {
      return (
        <span className="text-xs font-medium text-slate-500">
          Current account
        </span>
      )
    }

    return (
      <button
        type="button"
        onClick={() => {
          setStatusError(null)
          setStatusTarget(user)
        }}
        className={`rounded-md px-2.5 py-1.5 text-xs font-medium transition ${
          user.isActive
            ? 'border border-red-300 bg-white text-red-700 hover:bg-red-50'
            : 'bg-brand-600 text-white hover:bg-brand-700'
        }`}
      >
        {user.isActive ? 'Deactivate' : 'Activate'}
      </button>
    )
  }

  return (
    <div>
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
          User management
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Review accounts and control login access without changing roles or
          verification.
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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <label
              htmlFor="admin-user-search"
              className="block text-sm font-medium text-slate-700"
            >
              Search
            </label>
            <input
              id="admin-user-search"
              type="search"
              value={draft.q}
              onChange={(event) =>
                setDraft((current) => ({ ...current, q: event.target.value }))
              }
              placeholder="Name, email, or phone"
              maxLength={100}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="admin-user-role"
              className="block text-sm font-medium text-slate-700"
            >
              Role
            </label>
            <select
              id="admin-user-role"
              value={draft.role}
              onChange={(event) =>
                setDraft((current) => ({ ...current, role: event.target.value }))
              }
              className={inputClass}
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="admin-user-active"
              className="block text-sm font-medium text-slate-700"
            >
              Active
            </label>
            <select
              id="admin-user-active"
              value={draft.isActive}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  isActive: event.target.value,
                }))
              }
              className={inputClass}
            >
              {BOOLEAN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="admin-user-verified"
              className="block text-sm font-medium text-slate-700"
            >
              Verified
            </label>
            <select
              id="admin-user-verified"
              value={draft.isVerified}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  isVerified: event.target.value,
                }))
              }
              className={inputClass}
            >
              {BOOLEAN_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="admin-user-sort"
              className="block text-sm font-medium text-slate-700"
            >
              Sort by
            </label>
            <select
              id="admin-user-sort"
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
          <LoadingState label="Loading user accounts…" />
        </div>
      ) : state.error ? (
        <div className="mt-8">
          <ErrorState message={state.error} onRetry={() => load()} />
        </div>
      ) : users.length === 0 ? (
        <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">
            No user accounts found
          </h2>
          <p className="mt-2 text-sm text-slate-600">
            Try changing the search, role, or status filters.
          </p>
        </div>
      ) : (
        <>
          <div className="mt-6 hidden overflow-x-auto rounded-lg border border-slate-200 bg-white shadow-sm md:block">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  {[
                    'User',
                    'Role',
                    'Account',
                    'Verified',
                    'Joined',
                    'Action',
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
                {users.map((user) => (
                  <tr key={user.id} className="align-top">
                    <td className="px-4 py-4">
                      <p className="text-sm font-semibold text-slate-900">
                        {user.name}
                        {user.id === currentUser?.id ? (
                          <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                            You
                          </span>
                        ) : null}
                      </p>
                      <p className="mt-0.5 break-all text-xs text-slate-500">
                        {user.email}
                      </p>
                      <p className="text-xs text-slate-500">
                        {user.phone || 'No phone'}
                      </p>
                    </td>
                    <td className="px-4 py-4">
                      <RoleBadge role={user.role} />
                    </td>
                    <td className="px-4 py-4">
                      <AccountStatus isActive={user.isActive} />
                    </td>
                    <td className="px-4 py-4 text-sm text-slate-700">
                      {user.isVerified ? 'Yes' : 'No'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-4 text-sm text-slate-600">
                      {formatAdminDate(user.createdAt)}
                    </td>
                    <td className="px-4 py-4">{statusAction(user)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-6 space-y-3 md:hidden">
            {users.map((user) => (
              <article
                key={user.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {user.name}
                      {user.id === currentUser?.id ? (
                        <span className="ml-2 rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-medium text-brand-700">
                          You
                        </span>
                      ) : null}
                    </h2>
                    <p className="break-all text-xs text-slate-500">
                      {user.email}
                    </p>
                  </div>
                  <AccountStatus isActive={user.isActive} />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <RoleBadge role={user.role} />
                  <span className="text-xs text-slate-500">
                    Verified: {user.isVerified ? 'Yes' : 'No'}
                  </span>
                </div>
                <div className="mt-3">{statusAction(user)}</div>
              </article>
            ))}
          </div>

          <AdminPagination
            pagination={pagination}
            currentPage={currentPage}
            onChange={changePage}
            label="User pagination"
          />
        </>
      )}

      {statusTarget ? (
        <StatusDialog
          user={statusTarget}
          submitting={submitting}
          error={statusError}
          onClose={() => {
            if (!submitting) {
              setStatusTarget(null)
              setStatusError(null)
            }
          }}
          onConfirm={confirmStatusChange}
        />
      ) : null}
    </div>
  )
}
