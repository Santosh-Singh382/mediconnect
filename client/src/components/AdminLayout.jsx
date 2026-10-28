import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import AdminIcon from './AdminIcon.jsx'
import NotificationBell from './NotificationBell.jsx'
import { useAuth } from '../hooks/useAuth.js'
import { useNotifications } from '../hooks/useNotifications.js'
import { BRAND_NAME } from '../lib/branding.js'

const NAV_SECTIONS = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: 'dashboard', end: true },
    ],
  },
  {
    label: 'Management',
    items: [
      { to: '/admin/doctors', label: 'Doctors', icon: 'doctors' },
      { to: '/admin/pharmacies', label: 'Pharmacies', icon: 'pharmacies' },
      { to: '/admin/users', label: 'Users', icon: 'users' },
      { to: '/admin/medicines', label: 'Medicines', icon: 'medicines' },
      { to: '/admin/orders', label: 'Orders', icon: 'orders' },
    ],
  },
  {
    label: 'Activity',
    items: [
      {
        to: '/admin/notifications',
        label: 'Notifications',
        icon: 'notifications',
      },
    ],
  },
]

const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items)

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) return 'A'
  return parts
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

function pageTitle(pathname) {
  if (pathname === '/admin' || pathname === '/admin/dashboard') {
    return 'Dashboard'
  }
  if (pathname.startsWith('/admin/orders/')) {
    return 'Order details'
  }
  const match = NAV_ITEMS.find(
    (item) => item.to !== '/admin' && pathname.startsWith(item.to),
  )
  return match?.label || 'Admin'
}

function NavItems({ onNavigate, unreadCount }) {
  return (
    <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Admin">
      {NAV_SECTIONS.map((section, sectionIndex) => (
        <div
          key={section.label}
          className={sectionIndex > 0 ? 'mt-6' : undefined}
        >
          <p className="mb-1.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {section.label}
          </p>
          <ul className="space-y-0.5">
            {section.items.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    `group flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-lg shadow-blue-950/30'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-white'
                    }`
                  }
                >
                  {({ isActive }) => (
                    <>
                      <AdminIcon
                        name={item.icon}
                        className={`h-[18px] w-[18px] shrink-0 ${
                          isActive
                            ? 'text-blue-100'
                            : 'text-slate-500 group-hover:text-slate-300'
                        }`}
                      />
                      <span className="truncate">{item.label}</span>
                      {item.icon === 'notifications' && unreadCount > 0 ? (
                        <span className="ml-auto inline-flex min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold leading-none text-white">
                          {unreadCount > 99 ? '99+' : unreadCount}
                        </span>
                      ) : null}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-xl font-semibold text-white">
        +
      </span>
      <div className="leading-tight">
        <p className="mb-0 text-[15px] font-semibold tracking-tight text-white">
          {BRAND_NAME}
        </p>
        <p className="mb-0 text-[11px] font-medium uppercase tracking-wider text-slate-400">
          Admin console
        </p>
      </div>
    </div>
  )
}

function AccountBlock({ user, onLogout, onNavigate }) {
  return (
    <div className="border-t border-slate-800 p-3">
      <Link
        to="/account"
        onClick={onNavigate}
        className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
          {initials(user?.name)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-medium text-white">
            {user?.name || 'Administrator'}
          </span>
          <span className="block truncate text-xs text-slate-400">
            {user?.email || 'Admin account'}
          </span>
        </span>
      </Link>
      <button
        type="button"
        onClick={onLogout}
        className="mt-1 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-slate-400 transition-colors hover:bg-red-950/60 hover:text-red-300"
      >
        <AdminIcon name="logout" className="h-[18px] w-[18px]" />
        Sign out
      </button>
    </div>
  )
}

export default function AdminLayout() {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotifications()
  const location = useLocation()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const closeButtonRef = useRef(null)
  const menuButtonRef = useRef(null)
  const mobileNavRef = useRef(null)
  const wasOpenRef = useRef(false)

  const title = pageTitle(location.pathname)

  useEffect(() => {
    setMobileOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!mobileOpen) {
      if (wasOpenRef.current) {
        wasOpenRef.current = false
        menuButtonRef.current?.focus()
      }
      return undefined
    }

    wasOpenRef.current = true
    closeButtonRef.current?.focus()

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setMobileOpen(false)
        return
      }

      if (event.key !== 'Tab') return

      const focusable = Array.from(
        mobileNavRef.current?.querySelectorAll(FOCUSABLE_SELECTOR) || [],
      ).filter((element) => element.getClientRects().length > 0)

      if (focusable.length === 0) {
        event.preventDefault()
        mobileNavRef.current?.focus()
        return
      }

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (!mobileNavRef.current?.contains(active)) {
        event.preventDefault()
        first.focus()
      } else if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', handleKeyDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [mobileOpen])

  function handleLogout() {
    logout()
    navigate('/', { replace: true })
  }

  function closeMobile() {
    setMobileOpen(false)
  }

  return (
    <div className="admin-console min-h-dvh bg-slate-50">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col border-r border-slate-800 bg-slate-950 lg:flex">
        <div className="flex h-16 items-center border-b border-slate-800 px-5">
          <Brand />
        </div>
        <NavItems unreadCount={unreadCount} />
        <div className="mx-4 mb-3 rounded-xl border border-slate-800 bg-slate-900 p-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-emerald-300">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_3px_rgba(52,211,153,0.12)]" />
            Systems operational
          </div>
          <p className="mb-0 mt-1 text-[11px] leading-4 text-slate-400">
            Privacy controls are active across the console.
          </p>
        </div>
        <div className="border-t border-slate-800">
          <AccountBlock user={user} onLogout={handleLogout} />
        </div>
      </aside>

      <header className="sticky top-0 z-20 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl lg:pl-[264px]">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <button
              ref={menuButtonRef}
              type="button"
              onClick={() => setMobileOpen(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 lg:hidden"
              aria-label="Open navigation"
              aria-expanded={mobileOpen}
              aria-controls="admin-mobile-navigation"
            >
              <AdminIcon name="menu" className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="mb-0 hidden text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-600 sm:block">
                Operations center
              </p>
              <p className="mb-0 truncate text-base font-semibold text-slate-900">
                {title}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <div className="hidden items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-400 md:flex">
              <AdminIcon name="search" className="h-3.5 w-3.5" />
              <span>Search workspace</span>
              <kbd className="ml-3 rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                /
              </kbd>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 sm:inline-flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Live
            </span>
            <NotificationBell />
            <Link
              to="/account"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
              aria-label="Open account settings"
              title={user?.name || 'Administrator'}
            >
              {initials(user?.name)}
            </Link>
          </div>
        </div>
      </header>

      <div className="lg:pl-[264px]">
        <main className="admin-content mx-auto w-full max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <Outlet />
        </main>
      </div>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            aria-hidden="true"
            onClick={closeMobile}
            className="absolute inset-0 bg-slate-950/50"
          />
          <aside
            ref={mobileNavRef}
            id="admin-mobile-navigation"
            role="dialog"
            aria-modal="true"
            aria-label="Admin navigation"
            tabIndex={-1}
            className="absolute inset-y-0 left-0 flex w-[288px] max-w-[86vw] flex-col bg-slate-950 shadow-xl outline-none"
          >
            <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4">
              <Brand />
              <button
                ref={closeButtonRef}
                type="button"
                onClick={closeMobile}
                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
                aria-label="Close navigation"
              >
                <AdminIcon name="close" className="h-5 w-5" />
              </button>
            </div>
            <NavItems onNavigate={closeMobile} unreadCount={unreadCount} />
            <AccountBlock
              user={user}
              onLogout={handleLogout}
              onNavigate={closeMobile}
            />
          </aside>
        </div>
      ) : null}
    </div>
  )
}
