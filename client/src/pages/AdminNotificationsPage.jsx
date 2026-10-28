import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/Button.jsx'
import Alert from '../components/Alert.jsx'
import EmptyState from '../components/EmptyState.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import AdminIcon from '../components/AdminIcon.jsx'
import AdminPagination from '../components/AdminPagination.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useNotifications } from '../hooks/useNotifications.js'
import { getNotifications } from '../lib/notificationApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatNotificationDate,
  NOTIFICATION_TYPE_STYLES,
  notificationLinkLabel,
  notificationPath,
} from '../lib/notificationFormat.js'

const PAGE_LIMIT = 20

const FILTERS = [
  { value: 'all', label: 'All notifications' },
  { value: 'unread', label: 'Unread' },
]

function notificationIcon(type) {
  if (type?.startsWith('DOCTOR_')) return 'doctors'
  if (type?.startsWith('PHARMACY_')) return 'pharmacies'
  if (type?.startsWith('ORDER_') || type === 'NEW_ORDER') return 'orders'
  return 'notifications'
}

function emptyPagination() {
  return { page: 1, limit: PAGE_LIMIT, total: 0, totalPages: 0 }
}

export default function AdminNotificationsPage() {
  const { user } = useAuth()
  const { unreadCount, markRead, markAllRead } = useNotifications()
  const [filter, setFilter] = useState('all')
  const [page, setPage] = useState(1)
  const [state, setState] = useState({
    loading: true,
    error: null,
    data: null,
  })
  const [markingId, setMarkingId] = useState(null)
  const [markingAll, setMarkingAll] = useState(false)
  const [actionError, setActionError] = useState(null)
  const requestVersion = useRef(0)

  const load = useCallback(async () => {
    requestVersion.current += 1
    const version = requestVersion.current
    setState((current) => ({ ...current, loading: true, error: null }))

    const params = { page, limit: PAGE_LIMIT }
    if (filter === 'unread') {
      params.unreadOnly = true
    }

    try {
      const response = await getNotifications(params)
      if (requestVersion.current !== version) return
      setState({ loading: false, error: null, data: response.data.data })
    } catch (error) {
      if (requestVersion.current !== version) return
      setState((current) => ({
        ...current,
        loading: false,
        error: getApiErrorMessage(
          error,
          'Unable to load notifications right now.',
        ),
      }))
    }
  }, [filter, page])

  useEffect(() => {
    load()
    return () => {
      requestVersion.current += 1
    }
  }, [load])

  const notifications = state.data?.notifications || []
  const pagination = state.data?.pagination || emptyPagination()
  const currentPage = pagination.page || page
  const hasData = Boolean(state.data)

  function changeFilter(nextFilter) {
    if (nextFilter === filter) return
    setActionError(null)
    setPage(1)
    setFilter(nextFilter)
  }

  function changePage(nextPage) {
    setActionError(null)
    setPage(nextPage)
  }

  async function handleMarkRead(notification) {
    if (notification.isRead || markingId || markingAll) return

    setMarkingId(notification.id)
    setActionError(null)
    try {
      await markRead(notification.id)

      if (
        filter === 'unread' &&
        notifications.length === 1 &&
        currentPage > 1
      ) {
        setPage(currentPage - 1)
        return
      }

      setState((current) => {
        if (!current.data) return current
        const remaining = current.data.notifications.filter(
          (item) => item.id !== notification.id,
        )
        const total = Math.max(0, (current.data.pagination?.total || 0) - 1)
        return {
          ...current,
          data: {
            ...current.data,
            notifications:
              filter === 'unread'
                ? remaining
                : current.data.notifications.map((item) =>
                    item.id === notification.id
                      ? { ...item, isRead: true }
                      : item,
                  ),
            pagination:
              filter === 'unread'
                ? {
                    ...(current.data.pagination || emptyPagination()),
                    total,
                    totalPages:
                      total === 0
                        ? 0
                        : Math.ceil(total / PAGE_LIMIT),
                  }
                : current.data.pagination,
          },
        }
      })
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          'Unable to mark this notification as read right now.',
        ),
      )
    } finally {
      setMarkingId(null)
    }
  }

  async function handleMarkAllRead() {
    if (unreadCount === 0 || markingAll || markingId) return

    setMarkingAll(true)
    setActionError(null)
    try {
      await markAllRead()
      setState((current) => {
        if (!current.data) return current
        if (filter === 'unread') {
          return {
            ...current,
            data: {
              ...current.data,
              notifications: [],
              pagination: {
                ...(current.data.pagination || emptyPagination()),
                total: 0,
                totalPages: 0,
              },
            },
          }
        }
        return {
          ...current,
          data: {
            ...current.data,
            notifications: current.data.notifications.map((item) => ({
              ...item,
              isRead: true,
            })),
          },
        }
      })
      if (filter === 'unread' && page !== 1) {
        setPage(1)
      }
    } catch (error) {
      setActionError(
        getApiErrorMessage(
          error,
          'Unable to mark all notifications as read right now.',
        ),
      )
    } finally {
      setMarkingAll(false)
    }
  }

  function handleOpenNotification(notification) {
    if (!notification.isRead) {
      markRead(notification.id).catch(() => {})
    }
  }

  const total = pagination.total || 0
  const totalLabel =
    filter === 'unread'
      ? `${total.toLocaleString('en-IN')} unread`
      : `${total.toLocaleString('en-IN')} ${
          total === 1 ? 'notification' : 'notifications'
        }`

  if (state.loading && !hasData) {
    return (
      <div>
        <PageHeader
          eyebrow="Admin inbox"
          title="Notifications"
          description="Updates and activity for your admin account."
        />
        <div className="mt-6">
          <LoadingState label="Loading notifications…" />
        </div>
      </div>
    )
  }

  if (state.error && !hasData) {
    return (
      <div>
        <PageHeader
          eyebrow="Admin inbox"
          title="Notifications"
          description="Updates and activity for your admin account."
        />
        <div className="mt-6">
          <ErrorState message={state.error} onRetry={load} />
        </div>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        eyebrow="Admin inbox"
        title="Notifications"
        description={
          unreadCount > 0
            ? `${unreadCount} unread ${
                unreadCount === 1 ? 'notification' : 'notifications'
              } across your admin account.`
            : 'You are all caught up. New admin notifications will appear here.'
        }
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="secondary"
              onClick={load}
              disabled={state.loading || markingAll || Boolean(markingId)}
              loading={state.loading}
            >
              {state.loading ? null : (
                <AdminIcon name="refresh" className="h-4 w-4" />
              )}
              Refresh
            </Button>
            <Button
              onClick={handleMarkAllRead}
              disabled={unreadCount === 0 || markingAll || Boolean(markingId)}
              loading={markingAll}
            >
              {markingAll ? null : (
                <AdminIcon name="check" className="h-4 w-4" />
              )}
              Mark all as read
            </Button>
          </div>
        }
      />

      {actionError ? (
        <Alert
          variant="danger"
          className="mt-4"
          title="Action failed"
          onDismiss={() => setActionError(null)}
        >
          {actionError}
        </Alert>
      ) : null}

      {state.error && hasData ? (
        <Alert
          variant="warning"
          className="mt-4"
          title="Notifications may be out of date"
          action={
            <Button size="xs" variant="secondary" onClick={load}>
              Try again
            </Button>
          }
        >
          {state.error}
        </Alert>
      ) : null}

      <div className="mt-5 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div
          role="group"
          aria-label="Filter notifications"
          className="flex flex-wrap gap-1"
        >
          {FILTERS.map((option) => {
            const active = filter === option.value
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => changeFilter(option.value)}
                aria-pressed={active}
                className={`inline-flex h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {option.label}
                {option.value === 'unread' && unreadCount > 0 ? (
                  <span
                    className={`rounded-full px-1.5 py-0.5 text-[11px] font-semibold leading-none ${
                      active
                        ? 'bg-white/20 text-white'
                        : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {unreadCount}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
        <p
          className="mb-0 px-1 text-xs text-slate-500"
          aria-live="polite"
        >
          {state.loading ? 'Updating…' : totalLabel}
        </p>
      </div>

      <div
        aria-busy={state.loading || undefined}
        className={`mt-4 transition-opacity ${
          state.loading ? 'opacity-60' : ''
        }`}
      >
        {notifications.length === 0 ? (
          <EmptyState
            icon={<AdminIcon name="notifications" className="h-6 w-6" />}
            title={
              filter === 'unread'
                ? 'No unread notifications'
                : 'No notifications yet'
            }
            description={
              filter === 'unread'
                ? 'You have read every notification in your admin inbox.'
                : 'Notifications for your admin account will appear here.'
            }
            action={
              filter === 'all'
                ? () => {
                    if (page === 1) {
                      load()
                    } else {
                      setPage(1)
                    }
                  }
                : undefined
            }
            actionLabel="Refresh"
          />
        ) : (
          <section aria-label="Notifications list" className="space-y-3">
            {notifications.map((notification) => {
              const path = notificationPath(notification, user?.role)
              const iconName = notificationIcon(notification.type)
              const iconClassName =
                NOTIFICATION_TYPE_STYLES[notification.type] ||
                'bg-slate-100 text-slate-500'
              const isMarking = markingId === notification.id

              return (
                <article
                  key={notification.id}
                  className={`rounded-xl border p-4 shadow-sm transition-colors sm:p-5 ${
                    notification.isRead
                      ? 'border-slate-200 bg-white'
                      : 'border-blue-200 bg-blue-50/40'
                  }`}
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
                    >
                      <AdminIcon name={iconName} className="h-5 w-5" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            {path ? (
                              <Link
                                to={path}
                                onClick={() =>
                                  handleOpenNotification(notification)
                                }
                                className="text-sm font-semibold text-slate-900 hover:text-blue-700"
                              >
                                {notification.title || 'Notification'}
                              </Link>
                            ) : (
                              <h2 className="mb-0 text-sm font-semibold text-slate-900">
                                {notification.title || 'Notification'}
                              </h2>
                            )}
                            {notification.isRead ? null : (
                              <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-700">
                                Unread
                              </span>
                            )}
                          </div>
                          <p className="mb-0 mt-1 text-sm leading-6 text-slate-600">
                            {notification.message ||
                              'No additional details were provided.'}
                          </p>
                          <p className="mb-0 mt-2 text-xs text-slate-400">
                            {formatNotificationDate(
                              notification.createdAt,
                            ) || 'Date unavailable'}
                          </p>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {notification.isRead ? null : (
                            <Button
                              size="xs"
                              variant="secondary"
                              onClick={() => handleMarkRead(notification)}
                              loading={isMarking}
                              disabled={
                                markingAll ||
                                (Boolean(markingId) && !isMarking)
                              }
                            >
                              Mark as read
                            </Button>
                          )}
                          {path ? (
                            <Link
                              to={path}
                              onClick={() =>
                                handleOpenNotification(notification)
                              }
                              className="inline-flex h-8 items-center justify-center rounded-lg bg-blue-600 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                            >
                              {notificationLinkLabel(notification)}
                            </Link>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </section>
        )}
      </div>

      {notifications.length > 0 && pagination.totalPages > 1 ? (
        <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <AdminPagination
            pagination={pagination}
            currentPage={currentPage}
            onChange={changePage}
            label="Notification pagination"
          />
        </div>
      ) : null}
    </div>
  )
}
