import { useCallback, useEffect, useState } from 'react'
import api from '../lib/api.js'
import { BRAND_NAME } from '../lib/branding.js'

const STATES = {
  LOADING: 'loading',
  ONLINE: 'online',
  OFFLINE: 'offline',
}

export default function SystemStatus() {
  const [status, setStatus] = useState(STATES.LOADING)
  const [detail, setDetail] = useState(null)

  const loadHealth = useCallback(() => {
    api
      .get('/health')
      .then(({ data }) => {
        setDetail(data?.data ?? null)
        setStatus(STATES.ONLINE)
      })
      .catch(() => {
        setDetail(null)
        setStatus(STATES.OFFLINE)
      })
  }, [])

  useEffect(() => {
    loadHealth()
  }, [loadHealth])

  const handleRetry = () => {
    setStatus(STATES.LOADING)
    loadHealth()
  }

  const presentation = {
    [STATES.LOADING]: {
      dot: 'bg-slate-400 animate-pulse',
      label: 'Checking API status',
      description: `Contacting the ${BRAND_NAME} backend.`,
    },
    [STATES.ONLINE]: {
      dot: 'bg-emerald-500',
      label: 'API operational',
      description: detail?.environment
        ? `Backend reachable in ${detail.environment} mode.`
        : 'Backend reachable.',
    },
    [STATES.OFFLINE]: {
      dot: 'bg-red-500',
      label: 'API unreachable',
      description: 'The backend did not respond. Start the server and retry.',
    },
  }[status]

  return (
    <section
      aria-live="polite"
      className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className={`h-2.5 w-2.5 rounded-full ${presentation.dot}`} />
          <div>
            <p className="text-sm font-semibold text-slate-900">
              {presentation.label}
            </p>
            <p className="text-sm text-slate-500">{presentation.description}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleRetry}
          disabled={status === STATES.LOADING}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Retry
        </button>
      </div>
    </section>
  )
}
