import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import WorkspaceShell from '../components/WorkspaceShell.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useNotifications } from '../hooks/useNotifications.js'
import { getNotifications } from '../lib/notificationApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatNotificationDate,
  notificationLinkLabel,
  notificationPath,
} from '../lib/notificationFormat.js'

const PAGE_LIMIT = 20

export default function NotificationsPage() {
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

  const load = useCallback(() => {
    requestVersion.current += 1
    const version = requestVersion.current

    const params = { page, limit: PAGE_LIMIT }
    if (filter === 'unread') {
      params.unreadOnly = true
    }

    return getNotifications(params)
      .then((response) => {
        if (requestVersion.current !== version) {
          return null
        }
        setState({ loading: false, error: null, data: response.data.data })
        return response.data.data
      })
      .catch((error) => {
        if (requestVersion.current !== version) {
          return null
        }
        setState({
          loading: false,
          error: getApiErrorMessage(
            error,
            'Unable to load notifications right now.',
          ),
          data: null,
        })
        return null
      })
  }, [filter, page])

  useEffect(() => {
    load()
    return () => {
      requestVersion.current += 1
    }
  }, [load])

  const notifications = state.data?.notifications || []
  const pagination = state.data?.pagination || {
    page: 1,
    total: 0,
    totalPages: 0,
  }
  const currentPage = pagination.page || page

  function beginLoading() {
    setState({ loading: true, error: null, data: null })
  }

  function changeFilter(nextFilter) {
    if (nextFilter === filter) {
      return
    }
    beginLoading()
    setFilter(nextFilter)
    setPage(1)
  }

  function changePage(nextPage) {
    beginLoading()
    setPage(nextPage)
  }

  async function handleMarkRead(notification) {
    if (notification.isRead || markingId) {
      return
    }

    setMarkingId(notification.id)
    setActionError(null)
    try {
      await markRead(notification.id)
      if (filter === 'unread') {
        beginLoading()
        await load()
      } else {
        setState((current) => {
          if (!current.data) {
            return current
          }
          return {
            ...current,
            data: {
              ...current.data,
              notifications: current.data.notifications.map((item) =>
                item.id === notification.id
                  ? { ...item, isRead: true }
                  : item,
              ),
            },
          }
        })
      }
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
    if (unreadCount === 0 || markingAll) {
      return
    }

    setMarkingAll(true)
    setActionError(null)
    try {
      await markAllRead()
      if (filter === 'unread') {
        beginLoading()
        await load()
      } else {
        setState((current) => {
          if (!current.data) {
            return current
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

  function retry() {
    beginLoading()
    load()
  }

  function handleOpenNotification(notification) {
    if (!notification.isRead) {
      markRead(notification.id).catch(() => {})
    }
  }

  return (
    <WorkspaceShell user={user}>
      <div className="py-2 lg:py-4">
        <section className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900">
              Notifications
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {unreadCount > 0
                ? `${unreadCount} unread notification${
                    unreadCount === 1 ? '' : 's'
                  }`
                : 'You are all caught up.'}
            </p>
          </div>
          <button
            type="button"
            onClick={handleMarkAllRead}
            disabled={unreadCount === 0 || markingAll}
            className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {markingAll ? 'Marking…' : 'Mark all as read'}
          </button>
        </section>

        <div className="mt-6 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => changeFilter('all')}
            aria-pressed={filter === 'all'}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              filter === 'all'
                ? 'bg-brand-600 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            All notifications
          </button>
          <button
            type="button"
            onClick={() => changeFilter('unread')}
            aria-pressed={filter === 'unread'}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
              filter === 'unread'
                ? 'bg-brand-600 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            Unread
          </button>
        </div>

        {actionError ? (
          <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {actionError}
          </p>
        ) : null}

        {state.loading ? (
          <div className="mt-8">
            <LoadingState label="Loading notifications…" />
          </div>
        ) : state.error ? (
          <div className="mt-8">
            <ErrorState message={state.error} onRetry={retry} />
          </div>
        ) : notifications.length === 0 ? (
          <div className="mt-8 rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">
              {filter === 'unread'
                ? 'No unread notifications'
                : 'No notifications yet'}
            </h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {filter === 'unread'
                ? 'You have read all of your notifications.'
                : 'Order updates and verification decisions will appear here.'}
            </p>
          </div>
        ) : (
          <>
            <p className="mt-6 text-sm text-slate-500">
              {pagination.total}{' '}
              {pagination.total === 1 ? 'notification' : 'notifications'}
            </p>
            <section className="mt-3 space-y-3">
              {notifications.map((notification) => {
                const path = notificationPath(notification, user?.role)
                return (
                  <article
                    key={notification.id}
                    className={`rounded-lg border p-5 shadow-sm ${
                      notification.isRead
                        ? 'border-slate-200 bg-white'
                        : 'border-brand-200 bg-brand-50/40'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span
                          aria-hidden="true"
                          className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${
                            notification.isRead
                              ? 'bg-slate-200'
                              : 'bg-brand-600'
                          }`}
                        />
                        {path ? (
                          <Link
                            to={path}
                            onClick={() => handleOpenNotification(notification)}
                            className="min-w-0"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-semibold text-slate-900">
                                {notification.title}
                              </h2>
                              {notification.isRead ? null : (
                                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                                  Unread
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {notification.message}
                            </p>
                            <p className="mt-2 text-xs text-slate-400">
                              {formatNotificationDate(notification.createdAt)}
                            </p>
                          </Link>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenNotification(notification)}
                            className="min-w-0 text-left"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-base font-semibold text-slate-900">
                                {notification.title}
                              </h2>
                              {notification.isRead ? null : (
                                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-brand-700">
                                  Unread
                                </span>
                              )}
                            </div>
                            <p className="mt-1 text-sm text-slate-600">
                              {notification.message}
                            </p>
                            <p className="mt-2 text-xs text-slate-400">
                              {formatNotificationDate(notification.createdAt)}
                            </p>
                          </button>
                        )}
                      </div>

                      <div className="flex shrink-0 items-center gap-2">
                        {notification.isRead ? null : (
                          <button
                            type="button"
                            onClick={() => handleMarkRead(notification)}
                            disabled={markingId === notification.id}
                            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {markingId === notification.id
                              ? 'Marking…'
                              : 'Mark as read'}
                          </button>
                        )}
                        {path ? (
                          <Link
                            to={path}
                            onClick={() => handleOpenNotification(notification)}
                            className="rounded-md bg-brand-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand-700"
                          >
                            {notificationLinkLabel(notification)}
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )
              })}
            </section>

            {pagination.totalPages > 1 ? (
              <nav
                className="mt-8 flex flex-wrap items-center justify-between gap-3"
                aria-label="Notification pagination"
              >
                <p className="text-sm text-slate-500">
                  Showing page {currentPage} of {pagination.totalPages}
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => changePage(currentPage - 1)}
                    disabled={currentPage <= 1}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() => changePage(currentPage + 1)}
                    disabled={currentPage >= pagination.totalPages}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </WorkspaceShell>
  )
}
