import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader.jsx'
import Button from '../components/Button.jsx'
import Badge from '../components/Badge.jsx'
import StatCard from '../components/StatCard.jsx'
import Table from '../components/Table.jsx'
import Alert from '../components/Alert.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import AdminIcon from '../components/AdminIcon.jsx'
import StatusBadge from '../components/StatusBadge.jsx'
import {
  getAdminDashboard,
  getAdminDoctors,
  getAdminPharmacies,
  getAdminOrders,
  getAdminUsers,
} from '../lib/adminApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import {
  formatAdminDate,
  ROLE_BADGE_VARIANTS,
  roleLabel,
} from '../lib/adminFormat.js'
import {
  formatOrderDate,
  shortOrderId,
} from '../lib/orderFormat.js'
import { formatMedicinePrice } from '../lib/medicineFormat.js'

const METRIC_CARDS = [
  {
    key: 'totalUsers',
    label: 'Total users',
    description: 'Accounts across all roles',
    icon: 'users',
    iconClassName: 'bg-slate-100 text-slate-600',
    to: '/admin/users',
  },
  {
    key: 'totalDoctors',
    label: 'Doctor profiles',
    description: 'Registered doctor profiles',
    icon: 'doctors',
    iconClassName: 'bg-blue-50 text-blue-600',
    to: '/admin/doctors',
  },
  {
    key: 'pendingDoctorVerifications',
    label: 'Pending doctors',
    description: 'Awaiting verification review',
    icon: 'clock',
    iconClassName: 'bg-amber-50 text-amber-700',
    to: '/admin/doctors?status=PENDING',
  },
  {
    key: 'totalPharmacies',
    label: 'Pharmacies',
    description: 'Registered pharmacy profiles',
    icon: 'pharmacies',
    iconClassName: 'bg-emerald-50 text-emerald-700',
    to: '/admin/pharmacies',
  },
  {
    key: 'pendingPharmacyVerifications',
    label: 'Pending pharmacies',
    description: 'Awaiting verification review',
    icon: 'clock',
    iconClassName: 'bg-amber-50 text-amber-700',
    to: '/admin/pharmacies?status=PENDING',
  },
  {
    key: 'totalMedicines',
    label: 'Medicines',
    description: 'Listings across pharmacies',
    icon: 'medicines',
    iconClassName: 'bg-sky-50 text-sky-700',
    to: '/admin/medicines',
  },
  {
    key: 'totalOrders',
    label: 'Orders',
    description: 'Orders placed on the platform',
    icon: 'orders',
    iconClassName: 'bg-violet-50 text-violet-700',
    to: '/admin/orders',
  },
]

const RECENT_ORDER_COLUMNS = [
  {
    key: 'orderId',
    header: 'Order',
    render: (order) => (
      <Link
        to={`/admin/orders/${order.orderId}`}
        title={order.orderId}
        className="font-mono text-xs font-semibold text-blue-700 hover:text-blue-800"
      >
        {shortOrderId(order.orderId)}
      </Link>
    ),
  },
  {
    key: 'customerName',
    header: 'Customer',
    render: (order) => (
      <div>
        <p className="mb-0 text-slate-700">
          {order.customerName || 'Customer'}
        </p>
        <p className="mb-0 mt-0.5 text-xs text-slate-400">
          {order.deliveryCity || 'Location unavailable'}
        </p>
      </div>
    ),
  },
  {
    key: 'totalAmount',
    header: 'Total',
    align: 'right',
    noWrap: true,
    render: (order) => (
      <span className="font-medium text-slate-900">
        {formatMedicinePrice(order.totalAmount)}
      </span>
    ),
  },
  {
    key: 'orderStatus',
    header: 'Status',
    render: (order) => <StatusBadge status={order.orderStatus} dot />,
  },
  {
    key: 'placedAt',
    header: 'Placed',
    noWrap: true,
    render: (order) => (
      <span className="text-slate-500">
        {formatOrderDate(order.placedAt) || '—'}
      </span>
    ),
  },
]

const QUICK_ACTIONS = [
  {
    to: '/admin/doctors?status=PENDING',
    label: 'Review doctors',
    description: 'Clear the verification queue',
    icon: 'doctors',
  },
  {
    to: '/admin/pharmacies?status=PENDING',
    label: 'Verify pharmacies',
    description: 'Approve marketplace partners',
    icon: 'pharmacies',
  },
  {
    to: '/admin/orders',
    label: 'Monitor orders',
    description: 'Follow order progress',
    icon: 'orders',
  },
  {
    to: '/admin/users',
    label: 'Manage users',
    description: 'Review account access',
    icon: 'users',
  },
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

function QueueCard({
  title,
  description,
  icon,
  iconClassName,
  count,
  items,
  loaded,
  to,
  renderItem,
  emptyTitle,
  emptyDescription,
}) {
  const showUnavailable = !loaded || (count > 0 && items.length === 0)

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
      <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${iconClassName}`}
          >
            <AdminIcon name={icon} className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <h2 className="mb-0 text-sm font-semibold text-slate-900">{title}</h2>
            <p className="mb-0 mt-0.5 text-xs text-slate-500">
              {count > 0
                ? `${count} ${count === 1 ? 'profile' : 'profiles'} pending`
                : description}
            </p>
          </div>
        </div>
        <Link
          to={to}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
        >
          View queue
          <AdminIcon name="arrowRight" className="h-3.5 w-3.5" />
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <span
            className={`mx-auto flex h-10 w-10 items-center justify-center rounded-full ${
              showUnavailable
                ? 'bg-amber-50 text-amber-600'
                : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <AdminIcon
              name={showUnavailable ? 'alert' : 'check'}
              className="h-5 w-5"
            />
          </span>
          <p className="mb-0 mt-3 text-sm font-medium text-slate-900">
            {showUnavailable ? 'Queue preview unavailable' : emptyTitle}
          </p>
          <p className="mb-0 mt-1 text-xs text-slate-500">
            {showUnavailable
              ? count > 0
                ? `${count} ${
                    count === 1 ? 'profile is' : 'profiles are'
                  } pending. Open the full queue to review them.`
                : 'Open the full queue to check for pending profiles.'
              : emptyDescription}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                to={to}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
              >
                {renderItem(item)}
                <AdminIcon
                  name="chevronRight"
                  className="h-4 w-4 shrink-0 text-slate-300"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function AdminDashboardPage() {
  const [state, setState] = useState({
    loading: true,
    error: null,
    warnings: [],
    metrics: null,
    pendingDoctors: [],
    pendingDoctorsLoaded: false,
    pendingPharmacies: [],
    pendingPharmaciesLoaded: false,
    recentOrders: [],
    recentOrdersLoaded: false,
    recentUsers: [],
    recentUsersLoaded: false,
  })
  const requestVersion = useRef(0)

  const load = useCallback(async () => {
    requestVersion.current += 1
    const version = requestVersion.current
    setState((current) => ({ ...current, loading: true, error: null }))

    const results = await Promise.allSettled([
      getAdminDashboard(),
      getAdminDoctors({ status: 'PENDING', limit: 5, sort: 'oldest' }),
      getAdminPharmacies({ status: 'PENDING', limit: 5, sort: 'oldest' }),
      getAdminOrders({ limit: 5, sort: 'newest' }),
      getAdminUsers({ limit: 5, sort: 'newest' }),
    ])

    if (requestVersion.current !== version) return

    const [
      dashboardResult,
      doctorsResult,
      pharmaciesResult,
      ordersResult,
      usersResult,
    ] = results

    const warnings = []
    if (doctorsResult.status === 'rejected') {
      warnings.push(
        getApiErrorMessage(
          doctorsResult.reason,
          'Recent doctor verification requests could not be loaded.',
        ),
      )
    }
    if (pharmaciesResult.status === 'rejected') {
      warnings.push(
        getApiErrorMessage(
          pharmaciesResult.reason,
          'Recent pharmacy verification requests could not be loaded.',
        ),
      )
    }
    if (ordersResult.status === 'rejected') {
      warnings.push(
        getApiErrorMessage(
          ordersResult.reason,
          'Recent orders could not be loaded.',
        ),
      )
    }
    if (usersResult.status === 'rejected') {
      warnings.push(
        getApiErrorMessage(
          usersResult.reason,
          'Recent user accounts could not be loaded.',
        ),
      )
    }

    setState((current) => {
      const dashboardFailed = dashboardResult.status === 'rejected'
      const dashboardError = dashboardFailed
        ? getApiErrorMessage(
            dashboardResult.reason,
            'Unable to load the admin dashboard right now.',
          )
        : null

      const next = {
        loading: false,
        error:
          dashboardFailed && !current.metrics ? dashboardError : null,
        warnings:
          dashboardFailed && current.metrics
            ? [dashboardError, ...warnings]
            : warnings,
        metrics:
          dashboardResult.status === 'fulfilled'
            ? dashboardResult.value.data.data.metrics
            : current.metrics,
        pendingDoctors:
          doctorsResult.status === 'fulfilled'
            ? doctorsResult.value.data.data.doctors || []
            : current.pendingDoctors,
        pendingDoctorsLoaded:
          doctorsResult.status === 'fulfilled' ||
          current.pendingDoctorsLoaded,
        pendingPharmacies:
          pharmaciesResult.status === 'fulfilled'
            ? pharmaciesResult.value.data.data.pharmacies || []
            : current.pendingPharmacies,
        pendingPharmaciesLoaded:
          pharmaciesResult.status === 'fulfilled' ||
          current.pendingPharmaciesLoaded,
        recentOrders:
          ordersResult.status === 'fulfilled'
            ? ordersResult.value.data.data.orders || []
            : current.recentOrders,
        recentOrdersLoaded:
          ordersResult.status === 'fulfilled' ||
          current.recentOrdersLoaded,
        recentUsers:
          usersResult.status === 'fulfilled'
            ? usersResult.value.data.data.users || []
            : current.recentUsers,
        recentUsersLoaded:
          usersResult.status === 'fulfilled' ||
          current.recentUsersLoaded,
      }

      return next
    })
  }, [])

  useEffect(() => {
    load()
    return () => {
      requestVersion.current += 1
    }
  }, [load])

  const metrics = state.metrics
  const pendingDoctors = metrics?.pendingDoctorVerifications || 0
  const pendingPharmacies = metrics?.pendingPharmacyVerifications || 0

  if (state.loading && !metrics) {
    return (
      <div>
        <PageHeader
          eyebrow="Admin overview"
          title="Dashboard"
          description="Monitor platform activity, verification queues, and marketplace health."
        />
        <div className="mt-6">
          <LoadingState label="Loading platform overview…" />
        </div>
      </div>
    )
  }

  if (state.error && !metrics) {
    return (
      <div>
        <PageHeader
          eyebrow="Admin overview"
          title="Dashboard"
          description="Monitor platform activity, verification queues, and marketplace health."
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
        eyebrow="Admin overview"
        title="Dashboard"
        description="Monitor platform activity, verification queues, and marketplace health."
        action={
          <Button
            variant="secondary"
            onClick={load}
            disabled={state.loading}
            loading={state.loading}
          >
            {state.loading ? null : (
              <AdminIcon name="refresh" className="h-4 w-4" />
            )}
            Refresh
          </Button>
        }
      />

      <section className="relative mt-6 overflow-hidden rounded-[24px] bg-slate-950 px-5 py-6 text-white shadow-[0_20px_60px_rgba(15,23,42,0.18)] sm:px-8 sm:py-8">
        <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-blue-500/20 blur-2xl" />
        <div className="absolute -bottom-24 right-24 h-44 w-44 rounded-full bg-cyan-400/10 blur-2xl" />
        <div className="absolute bottom-0 right-0 h-px w-2/3 bg-gradient-to-r from-transparent via-blue-400/60 to-transparent" />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-400/30 bg-blue-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-blue-200">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-300" />
              Today at MediConnect
            </div>
            <h2 className="mb-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
              Keep every care partner moving.
            </h2>
            <p className="mb-0 max-w-xl text-sm leading-6 text-slate-300">
              Review verification requests, protect patient privacy, and keep
              the medicine marketplace running smoothly from one place.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <Link
              to="/admin/doctors?status=PENDING"
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 transition hover:bg-white/15"
            >
              <span className="block text-2xl font-semibold tabular-nums text-white">
                {pendingDoctors}
              </span>
              <span className="mt-1 block text-xs text-slate-300">Doctor reviews</span>
            </Link>
            <Link
              to="/admin/pharmacies?status=PENDING"
              className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 transition hover:bg-white/15"
            >
              <span className="block text-2xl font-semibold tabular-nums text-white">
                {pendingPharmacies}
              </span>
              <span className="mt-1 block text-xs text-slate-300">Pharmacy reviews</span>
            </Link>
          </div>
        </div>
      </section>

      {state.warnings.length > 0 ? (
        <Alert
          variant="warning"
          className="mt-4"
          title="Some dashboard data could not be loaded"
          action={
            <Button size="xs" variant="secondary" onClick={load}>
              Try again
            </Button>
          }
        >
          <ul className="mb-0 list-disc space-y-0.5 pl-4">
            {state.warnings.map((warning, index) => (
              <li key={`${warning}-${index}`}>{warning}</li>
            ))}
          </ul>
        </Alert>
      ) : null}

      <section aria-label="Platform metrics" className="mt-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {METRIC_CARDS.map((card) => {
            const value = metrics?.[card.key] ?? 0
            const isPendingMetric =
              card.key === 'pendingDoctorVerifications' ||
              card.key === 'pendingPharmacyVerifications'
            return (
              <Link
                key={card.key}
                to={card.to}
                className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
              >
                <StatCard
                  title={card.label}
                  value={value.toLocaleString('en-IN')}
                  description={
                    isPendingMetric && value === 0
                      ? 'No reviews waiting'
                      : card.description
                  }
                  icon={
                    <AdminIcon name={card.icon} className="h-5 w-5" />
                  }
                  iconClassName={card.iconClassName}
                  className="h-full border-transparent bg-white/95 transition duration-200 group-hover:-translate-y-1 group-hover:border-blue-200 group-hover:shadow-[0_16px_32px_rgba(37,99,235,0.12)]"
                />
              </Link>
            )
          })}
        </div>
      </section>

      <section
        aria-label="Verification queues"
        className="mt-6 grid gap-4 lg:grid-cols-2"
      >
        <QueueCard
          title="Doctor verification queue"
          description="Doctor profiles awaiting review"
          icon="doctors"
          iconClassName="bg-blue-50 text-blue-600"
          count={pendingDoctors}
          items={state.pendingDoctors}
          loaded={state.pendingDoctorsLoaded}
          to="/admin/doctors?status=PENDING"
          emptyTitle="No doctor profiles waiting"
          emptyDescription="New verification requests will appear here."
          renderItem={(doctor) => (
            <div className="min-w-0">
              <p className="mb-0 truncate text-sm font-medium text-slate-900">
                {doctor.name || 'Unnamed doctor'}
              </p>
              <p className="mb-0 mt-0.5 truncate text-xs text-slate-500">
                {doctor.specialization || 'Specialization not provided'}
                {doctor.createdAt
                  ? ` · Submitted ${formatAdminDate(doctor.createdAt)}`
                  : ''}
              </p>
            </div>
          )}
        />

        <QueueCard
          title="Pharmacy verification queue"
          description="Pharmacy profiles awaiting review"
          icon="pharmacies"
          iconClassName="bg-emerald-50 text-emerald-700"
          count={pendingPharmacies}
          items={state.pendingPharmacies}
          loaded={state.pendingPharmaciesLoaded}
          to="/admin/pharmacies?status=PENDING"
          emptyTitle="No pharmacy profiles waiting"
          emptyDescription="New verification requests will appear here."
          renderItem={(pharmacy) => (
            <div className="min-w-0">
              <p className="mb-0 truncate text-sm font-medium text-slate-900">
                {pharmacy.pharmacyName || 'Unnamed pharmacy'}
              </p>
              <p className="mb-0 mt-0.5 truncate text-xs text-slate-500">
                {[pharmacy.city, pharmacy.state].filter(Boolean).join(', ') ||
                  'Location not provided'}
                {pharmacy.createdAt
                  ? ` · Submitted ${formatAdminDate(pharmacy.createdAt)}`
                  : ''}
              </p>
            </div>
          )}
        />
      </section>

      <section className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="mb-0 text-sm font-semibold text-slate-900">
                Recent orders
              </h2>
              <p className="mb-0 mt-0.5 text-xs text-slate-500">
                Latest activity across all pharmacies
              </p>
            </div>
            <Link
              to="/admin/orders"
              className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
            >
              View all
              <AdminIcon name="arrowRight" className="h-3.5 w-3.5" />
            </Link>
          </div>
          <Table
            columns={RECENT_ORDER_COLUMNS}
            data={state.recentOrders}
            rowKey="orderId"
            minWidthClass="min-w-[640px]"
            caption="Recent orders"
            empty={
              state.recentOrdersLoaded
                ? 'No orders have been placed yet.'
                : 'Recent orders are unavailable right now.'
            }
          />
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <h2 className="mb-0 text-sm font-semibold text-slate-900">
                  Newest users
                </h2>
                <p className="mb-0 mt-0.5 text-xs text-slate-500">
                  Recently created accounts
                </p>
              </div>
              <Link
                to="/admin/users"
                className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-700"
              >
                View all
                <AdminIcon name="arrowRight" className="h-3.5 w-3.5" />
              </Link>
            </div>
            {state.recentUsers.length === 0 ? (
              <div className="px-5 py-8 text-center">
                <span className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                  <AdminIcon name="users" className="h-5 w-5" />
                </span>
                <p className="mb-0 mt-3 text-sm font-medium text-slate-900">
                  {state.recentUsersLoaded
                    ? 'No user accounts yet'
                    : 'Recent users are unavailable'}
                </p>
                <p className="mb-0 mt-1 text-xs text-slate-500">
                  {state.recentUsersLoaded
                    ? 'New accounts will appear here as users register.'
                    : 'Use the refresh action to try loading them again.'}
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {state.recentUsers.map((user) => (
                  <li key={user.id}>
                    <Link
                      to="/admin/users"
                      className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-slate-50"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
                        {initials(user.name)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="mb-0 truncate text-sm font-medium text-slate-900">
                          {user.name || 'Unnamed user'}
                        </p>
                        <p className="mb-0 truncate text-xs text-slate-500">
                          {user.email || 'No email'}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <Badge
                          variant={
                            ROLE_BADGE_VARIANTS[user.role] || 'neutral'
                          }
                          size="sm"
                        >
                          {roleLabel(user.role)}
                        </Badge>
                        <StatusBadge
                          status={user.isActive ? 'ACTIVE' : 'INACTIVE'}
                          size="sm"
                          dot
                        />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.04)]">
            <h2 className="mb-0 text-sm font-semibold text-slate-900">
              Quick actions
            </h2>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-1 2xl:grid-cols-2">
              {QUICK_ACTIONS.map((action) => (
                <Link
                  key={action.to}
                  to={action.to}
                  className="group flex items-start gap-3 rounded-lg border border-slate-200 p-3 transition-colors hover:border-blue-200 hover:bg-blue-50/40"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 transition-colors group-hover:bg-blue-100 group-hover:text-blue-600">
                    <AdminIcon name={action.icon} className="h-4 w-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-slate-900">
                      {action.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {action.description}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-5">
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white">
                <AdminIcon name="shield" className="h-4 w-4" />
              </span>
              <div>
                <h2 className="mb-1 text-sm font-semibold text-slate-900">
                  Privacy-first administration
                </h2>
                <p className="mb-0 text-xs leading-5 text-slate-600">
                  Patient medical records and prescriptions stay restricted.
                  This console shows only the minimum information needed for
                  orders, verification, and account access.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  )
}
