import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/Button.jsx'
import Input from '../components/Input.jsx'
import Select from '../components/Select.jsx'
import Table from '../components/Table.jsx'
import Badge from '../components/Badge.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import Alert from '../components/Alert.jsx'
import AdminPagination from '../components/AdminPagination.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import EmptyState from '../components/EmptyState.jsx'
import AdminIcon from '../components/AdminIcon.jsx'
import AdminUserDetailsModal from '../components/AdminUserDetailsModal.jsx'
import AdminAccountStatusDialog from '../components/AdminAccountStatusDialog.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { getAdminUsers, updateAdminUserStatus } from '../lib/adminApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  ADMIN_SORT_OPTIONS,
  formatAdminDate,
  ROLE_BADGE_VARIANTS,
  ROLE_OPTIONS,
  roleLabel,
} from '../lib/adminFormat.js'

const PAGE_LIMIT = 20

const ACTIVE_OPTIONS = [
  { value: '', label: 'Any account status' },
  { value: 'true', label: 'Active' },
  { value: 'false', label: 'Inactive' },
]

const VERIFIED_OPTIONS = [
  { value: '', label: 'Any verification' },
  { value: 'true', label: 'Verified' },
  { value: 'false', label: 'Not verified' },
]

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'U'
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function UserCell({ user, isCurrent = false }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
        {initials(user.name)}
      </span>
      <div className="min-w-0">
        <p className="mb-0 flex items-center gap-2 truncate font-medium text-slate-900">
          {user.name || 'Unnamed user'}
          {isCurrent ? (
            <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
              You
            </span>
          ) : null}
        </p>
        <p className="mb-0 mt-0.5 truncate text-xs text-slate-500">
          {user.email || 'No email'}
        </p>
      </div>
    </div>
  )
}

const COLUMNS = [
  {
    key: 'user',
    header: 'User',
    render: (user) => <UserCell user={user} />,
  },
  {
    key: 'role',
    header: 'Role',
    render: (user) => (
      <Badge variant={ROLE_BADGE_VARIANTS[user.role] || 'neutral'}>
        {roleLabel(user.role)}
      </Badge>
    ),
  },
  {
    key: 'isActive',
    header: 'Account',
    render: (user) => (
      <StatusBadge
        status={user.isActive ? 'ACTIVE' : 'INACTIVE'}
        dot
      />
    ),
  },
  {
    key: 'isVerified',
    header: 'Verified',
    render: (user) => (
      <StatusBadge
        status={user.isVerified ? 'VERIFIED' : 'UNVERIFIED'}
        dot
      />
    ),
  },
  {
    key: 'createdAt',
    header: 'Joined',
    noWrap: true,
    render: (user) => (
      <span className="text-slate-600">
        {formatAdminDate(user.createdAt) || '—'}
      </span>
    ),
  },
]

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
  const [viewing, setViewing] = useState(null)
  const [statusTarget, setStatusTarget] = useState(null)
  const [statusError, setStatusError] = useState(null)
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
      for (const key of ['q', 'role', 'isActive', 'isVerified', 'page']) {
        const value = searchParams.get(key)
        if (value) params[key] = value
      }

      return getAdminUsers(params)
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
              'Unable to load user accounts right now.',
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
      role: searchParams.get('role') || '',
      isActive: searchParams.get('isActive') || '',
      isVerified: searchParams.get('isVerified') || '',
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

  function renderActions(user) {
    if (user.id === currentUser?.id) {
      return (
        <span className="text-xs font-medium text-slate-400">
          Current account
        </span>
      )
    }

    return (
      <div className="flex items-center justify-end gap-1.5">
        <Button
          size="xs"
          variant="secondary"
          onClick={() => setViewing(user)}
        >
          View
        </Button>
        <Button
          size="xs"
          variant={user.isActive ? 'dangerOutline' : 'successOutline'}
          onClick={() => {
            setStatusError(null)
            setStatusTarget(user)
          }}
        >
          {user.isActive ? 'Deactivate' : 'Activate'}
        </Button>
      </div>
    )
  }

  const columns = [
    {
      ...COLUMNS[0],
      render: (user) => (
        <UserCell user={user} isCurrent={user.id === currentUser?.id} />
      ),
    },
    ...COLUMNS.slice(1),
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (user) => renderActions(user),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Users"
        description="Search accounts, review account details, and control login access."
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
        <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-6">
          <Input
            type="search"
            label="Search"
            containerClassName="sm:col-span-2"
            value={draft.q}
            onChange={(event) =>
              setDraft((current) => ({ ...current, q: event.target.value }))
            }
            placeholder="Name, email, or phone"
            maxLength={100}
            leadingIcon={<AdminIcon name="search" className="h-4 w-4" />}
          />
          <Select
            label="Role"
            value={draft.role}
            onChange={(event) =>
              setDraft((current) => ({ ...current, role: event.target.value }))
            }
            options={ROLE_OPTIONS}
          />
          <Select
            label="Account"
            value={draft.isActive}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                isActive: event.target.value,
              }))
            }
            options={ACTIVE_OPTIONS}
          />
          <Select
            label="Verified"
            value={draft.isVerified}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                isVerified: event.target.value,
              }))
            }
            options={VERIFIED_OPTIONS}
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
          <LoadingState label="Loading user accounts…" />
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

          {users.length === 0 ? (
            <div className="mt-6">
              <EmptyState
                title="No user accounts found"
                description="Try changing the search, role, or account filters."
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
                    User accounts
                  </h2>
                  <p className="mb-0 mt-0.5 text-xs text-slate-500">
                    {pagination?.total ?? users.length}{' '}
                    {pagination?.total === 1 ? 'account' : 'accounts'}
                  </p>
                </div>
                <span className="hidden text-xs text-slate-400 sm:block">
                  Deactivation blocks sign-in without changing roles.
                </span>
              </div>
              <Table
                columns={columns}
                data={users}
                rowKey="id"
                minWidthClass="min-w-[980px]"
                caption="User accounts"
              />
              <AdminPagination
                pagination={pagination}
                currentPage={currentPage}
                onChange={changePage}
                label="User pagination"
              />
            </div>
          )}
        </>
      )}

      {viewing ? (
        <AdminUserDetailsModal
          user={viewing}
          onClose={() => setViewing(null)}
        />
      ) : null}

      {statusTarget ? (
        <AdminAccountStatusDialog
          subject="User"
          name={statusTarget.name}
          isActive={statusTarget.isActive}
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
