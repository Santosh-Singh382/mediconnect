import OrderStatusBadge from './OrderStatusBadge.jsx'
import {
  CANCELLED_TIMELINE_STATUSES,
  formatOrderDate,
  ORDER_STATUS_DESCRIPTIONS,
  ORDER_TIMELINE_STATUSES,
  orderStatusLabel,
} from '../lib/orderFormat.js'

function normalizeHistory(statusHistory) {
  if (!Array.isArray(statusHistory)) return []

  return statusHistory.flatMap((entry) => {
    if (!entry || !ORDER_STATUS_DESCRIPTIONS[entry.status] || !entry.timestamp) {
      return []
    }

    const timestamp = new Date(entry.timestamp)
    if (Number.isNaN(timestamp.getTime())) {
      return []
    }

    return [{ status: entry.status, timestamp: timestamp.toISOString() }]
  })
}

function timelineStatuses(status) {
  return status === 'CANCELLED'
    ? CANCELLED_TIMELINE_STATUSES
    : ORDER_TIMELINE_STATUSES
}

function expectedHistoryStatuses(status) {
  if (status === 'CANCELLED') return CANCELLED_TIMELINE_STATUSES

  const currentIndex = ORDER_TIMELINE_STATUSES.indexOf(status)
  if (currentIndex === -1) return []
  return ORDER_TIMELINE_STATUSES.slice(0, currentIndex + 1)
}

function stepState(currentStatus, index, currentIndex) {
  if (currentStatus === 'DELIVERED') return 'completed'
  if (index < currentIndex) return 'completed'
  if (index === currentIndex) return 'current'
  return 'pending'
}

function StepMarker({ state, cancelled }) {
  if (state === 'completed') {
    return (
      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-600 text-white">
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          fill="none"
          className="h-4 w-4"
        >
          <path
            d="m5 10.5 3.2 3.2L15 7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </span>
    )
  }

  if (state === 'current') {
    return (
      <span
        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 ${
          cancelled
            ? 'border-red-600 bg-red-50'
            : 'border-brand-600 bg-brand-50'
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full ${
            cancelled ? 'bg-red-600' : 'bg-brand-600'
          }`}
        />
      </span>
    )
  }

  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-slate-300 bg-white">
      <span className="h-2 w-2 rounded-full bg-slate-300" />
    </span>
  )
}

function StateLabel({ state }) {
  const labels = {
    completed: 'Completed',
    current: 'Current',
    pending: 'Pending',
  }

  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
        state === 'completed'
          ? 'bg-green-100 text-green-800'
          : state === 'current'
            ? 'bg-brand-100 text-brand-800'
            : 'bg-slate-100 text-slate-600'
      }`}
    >
      {labels[state]}
    </span>
  )
}

export default function OrderStatusTimeline({ status, statusHistory = [] }) {
  const history = normalizeHistory(statusHistory)
  const historyByStatus = new Map()

  for (const entry of history) {
    if (!historyByStatus.has(entry.status)) {
      historyByStatus.set(entry.status, entry.timestamp)
    }
  }

  const expectedStatuses = expectedHistoryStatuses(status)
  const hasCompleteHistory =
    history.length > 0 &&
    expectedStatuses.length > 0 &&
    expectedStatuses.every((expected) => historyByStatus.has(expected))

  if (!hasCompleteHistory) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
        <OrderStatusBadge status={status} />
        <p className="mt-3 text-sm font-medium text-slate-900">
          Current status: {orderStatusLabel(status)}
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Detailed status history is not available for this order.
        </p>
      </div>
    )
  }

  const steps = timelineStatuses(status)
  const currentIndex = steps.indexOf(status)
  const cancelled = status === 'CANCELLED'

  return (
    <div>
      <ol aria-label="Order status timeline">
        {steps.map((step, index) => {
          const state = stepState(status, index, currentIndex)
          const timestamp = historyByStatus.get(step)
          const isLast = index === steps.length - 1

          return (
            <li
              key={step}
              aria-current={state === 'current' ? 'step' : undefined}
              className="relative flex gap-4 pb-6 last:pb-0"
            >
              {!isLast ? (
                <span
                  aria-hidden="true"
                  className={`absolute bottom-0 left-4 top-8 w-px ${
                    state === 'completed' ? 'bg-green-200' : 'bg-slate-200'
                  }`}
                />
              ) : null}

              <div className="relative z-10 shrink-0">
                <StepMarker
                  state={state}
                  cancelled={cancelled && step === 'CANCELLED'}
                />
              </div>

              <div className="min-w-0 flex-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold text-slate-900">
                    {orderStatusLabel(step)}
                  </h3>
                  <StateLabel state={state} />
                </div>
                <p className="mt-0.5 text-sm text-slate-600">
                  {ORDER_STATUS_DESCRIPTIONS[step]}
                </p>
                {timestamp ? (
                  <time
                    dateTime={timestamp}
                    className="mt-1 block text-xs text-slate-500"
                  >
                    {formatOrderDate(timestamp, { withTime: true })}
                  </time>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      {cancelled ? (
        <p className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          Order cancelled
        </p>
      ) : null}
    </div>
  )
}
