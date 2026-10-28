import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useNotifications } from '../hooks/useNotifications.js'
import {
  formatNotificationDate,
  notificationPath,
} from '../lib/notificationFormat.js'

export default function NotificationBell() {
  const { user } = useAuth()
  const {
    notifications,
    unreadCount,
    loading,
    error,
    refresh,
    markRead,
    markAllRead,
  } = useNotifications()
  const [open, setOpen] = useState(false)
  const [markingAll, setMarkingAll] = useState(false)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!open) {
      return undefined
    }

    const handlePointerDown = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setOpen(false)
      }
    }
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false)
      }
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  function toggle() {
    if (!open) {
      refresh()
    }
    setOpen((current) => !current)
  }

  async function handleMarkAll() {
    setMarkingAll(true)
    try {
      await markAllRead()
    } catch {
      setMarkingAll(false)
    } finally {
      setMarkingAll(false)
    }
  }

  function handleNotificationClick(notification) {
    if (!notification.isRead) {
      markRead(notification.id).catch(() => {})
    }
  }

  const notificationsPath =
    user?.role === 'ADMIN' ? '/admin/notifications' : '/notifications'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-label={
          unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        aria-expanded={open}
        aria-haspopup="true"
        className="relative rounded-md border border-slate-300 p-2 text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          className="h-5 w-5"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0"
          />
        </svg>
        {unreadCount > 0 ? (
          <span className="absolute -right-1.5 -top-1.5 flex min-h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-semibold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <div>
              <h2 className="mb-0 text-sm font-semibold text-slate-900">
                Notifications
              </h2>
              <p className="mb-0 text-xs text-slate-500">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : 'You are all caught up'}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAll}
                disabled={markingAll}
                className="text-xs font-medium text-brand-700 transition hover:text-brand-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Mark all as read
              </button>
            ) : null}
          </div>

          {loading && notifications.length === 0 ? (
            <p className="mb-0 px-4 py-6 text-center text-sm text-slate-500">
              Loading notifications…
            </p>
          ) : error && notifications.length === 0 ? (
            <p className="mb-0 px-4 py-6 text-center text-sm text-red-600">
              {error}
            </p>
          ) : notifications.length === 0 ? (
            <p className="mb-0 px-4 py-6 text-center text-sm text-slate-500">
              No notifications yet.
            </p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
              {notifications.map((notification) => {
                const path =
                  notificationPath(notification, user?.role) ||
                  notificationsPath
                return (
                  <li key={notification.id}>
                    <Link
                      to={path}
                      onClick={() => {
                        handleNotificationClick(notification)
                        setOpen(false)
                      }}
                      className={`block px-4 py-3 transition hover:bg-slate-50 ${
                        notification.isRead ? 'bg-white' : 'bg-brand-50/60'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <span
                          aria-hidden="true"
                          className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                            notification.isRead
                              ? 'bg-transparent'
                              : 'bg-brand-600'
                          }`}
                        />
                        <div className="min-w-0">
                          <p
                            className={`mb-0 text-sm ${
                              notification.isRead
                                ? 'font-medium text-slate-800'
                                : 'font-semibold text-slate-900'
                            }`}
                          >
                            {notification.title}
                          </p>
                          <p className="mb-0 mt-0.5 line-clamp-2 text-xs text-slate-600">
                            {notification.message}
                          </p>
                          <p className="mb-0 mt-1 text-[11px] text-slate-400">
                            {formatNotificationDate(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}

          <div className="border-t border-slate-200 px-4 py-2.5 text-center">
            <Link
              to={notificationsPath}
              onClick={() => setOpen(false)}
              className="text-xs font-medium text-brand-700 transition hover:text-brand-800"
            >
              View all notifications
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  )
}
