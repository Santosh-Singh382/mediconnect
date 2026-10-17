import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useConsultationCall } from '../hooks/useConsultationCall.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import AppointmentStatusBadge from '../components/AppointmentStatusBadge.jsx'
import { getAppointment } from '../lib/appointmentApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'
import { formatAppointmentDate, formatTimeRange, typeLabel } from '../lib/appointmentFormat.js'
import {
  MEDIA_ERROR_TEXT,
  consultationStatusMeta,
  wrongConsultationTypeMessage,
} from '../lib/consultation.js'

const AUDIO_ACCESS_STATUSES = ['CONFIRMED']

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

export default function AudioConsultationPage() {
  const { appointmentId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [appointmentState, setAppointmentState] = useState({
    loading: true,
    error: null,
    appointment: null,
  })

  const appointment = appointmentState.appointment
  const status = appointment ? appointment.status : null
  const appointmentType = appointment ? appointment.type : null
  const statusOk = status !== null && AUDIO_ACCESS_STATUSES.includes(status)
  const canAudio = appointmentType === 'AUDIO' && statusOk

  const remoteAudioRef = useRef(null)

  useEffect(() => {
    let active = true
    getAppointment(appointmentId)
      .then((response) => {
        if (!active) return
        setAppointmentState({
          loading: false,
          error: null,
          appointment: response.data.data.appointment,
        })
      })
      .catch((error) => {
        if (!active) return
        setAppointmentState({
          loading: false,
          error: getApiErrorMessage(error, 'This consultation is not available.'),
          appointment: null,
        })
      })
    return () => {
      active = false
    }
  }, [appointmentId])

  const {
    status: callStatus,
    errorType,
    errorMessage,
    remoteStream,
    micEnabled,
    toggleMic,
    endCall,
    retry,
  } = useConsultationCall({
    appointmentId,
    enabled: Boolean(canAudio && user),
    userId: user ? user.id : null,
    mediaType: 'audio',
  })

  // The remote audio stream is played out of the speaker. The local microphone
  // stream is never rendered back to the user, which would cause feedback.
  useEffect(() => {
    const element = remoteAudioRef.current
    if (!element) return undefined
    element.srcObject = remoteStream || null
    if (remoteStream) {
      const playPromise = element.play()
      if (playPromise && typeof playPromise.catch === 'function') {
        playPromise.catch(() => {})
      }
    }
    return () => {
      element.srcObject = null
    }
  }, [remoteStream])

  const { other, subtitle, backTo } = useMemo(() => {
    if (!appointment) {
      return { other: null, subtitle: '', backTo: '/appointments' }
    }
    if (user && user.role === 'DOCTOR') {
      return { other: appointment.patient, subtitle: 'Patient', backTo: '/doctor/appointments' }
    }
    return {
      other: appointment.doctor,
      subtitle: appointment.doctor.specialization || 'Doctor',
      backTo: '/appointments',
    }
  }, [appointment, user])

  const handleLeave = useCallback(() => {
    endCall()
    navigate(backTo)
  }, [endCall, navigate, backTo])

  if (appointmentState.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <LoadingState label="Checking appointment…" />
        </main>
      </div>
    )
  }

  if (appointmentState.error || !appointment) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <ErrorState
            message={appointmentState.error || 'This consultation is not available.'}
          />
          <div className="mt-4 text-center">
            <Link
              to="/appointments"
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Back to appointments
            </Link>
          </div>
        </main>
      </div>
    )
  }

  if (appointmentType !== 'AUDIO') {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h1 className="text-base font-semibold text-slate-900">
              Audio consultation not available
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {wrongConsultationTypeMessage(appointmentType, 'Audio')}
            </p>
            <Link
              to={backTo}
              className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Back to Appointment
            </Link>
          </div>
        </main>
      </div>
    )
  }

  if (!canAudio) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h1 className="text-base font-semibold text-slate-900">
              Audio consultation unavailable
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              An audio consultation can only be started for a confirmed appointment.
              The status of this appointment is {status.toLowerCase()}.
            </p>
            <Link
              to={backTo}
              className="mt-5 inline-block rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Back to appointments
            </Link>
          </div>
        </main>
      </div>
    )
  }

  const meta = consultationStatusMeta(callStatus)
  const isError = callStatus === 'error'
  const isTerminal = callStatus === 'ended' || callStatus === 'peer-left'
  const controlsDisabled = isError || callStatus === 'ended'

  const statusHeadline =
    callStatus === 'waiting'
      ? 'You are the only participant so far.'
      : callStatus === 'peer-left'
        ? 'The other participant left the consultation.'
        : callStatus === 'ended'
          ? 'The consultation has ended.'
          : callStatus === 'reconnecting'
            ? 'Reconnecting to the consultation…'
            : callStatus === 'connected'
              ? 'You are connected.'
              : 'Connecting to the other participant…'

  const statusHint =
    callStatus === 'waiting'
      ? 'Keep this page open. The consultation starts automatically when they join.'
      : callStatus === 'connected'
        ? 'Keep this page open while you talk.'
        : 'Please wait a moment.'

  return (
    <div className="flex min-h-screen flex-col bg-slate-900">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-4 sm:px-6 sm:py-6">
        <div className="mb-3 flex items-center justify-between gap-3">
          <Link
            to={backTo}
            className="text-sm font-medium text-brand-300 hover:text-brand-200"
          >
            ← Leave
          </Link>
          <span className={`rounded-full px-3 py-1 text-xs font-medium ${meta.tone}`}>
            {meta.label}
          </span>
        </div>

        <section className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-3 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-base font-semibold text-white">
                {other?.name || 'Participant'}
              </h1>
              <p className="text-xs text-slate-400">{subtitle}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-400">
                {formatAppointmentDate(appointment.appointmentDate)} ·{' '}
                {formatTimeRange(appointment.startTime, appointment.endTime)}
              </p>
              <p className="mt-0.5 text-xs text-slate-400">
                {typeLabel(appointment.type)} consultation
              </p>
              <div className="mt-1 flex justify-end">
                <AppointmentStatusBadge status={appointment.status} />
              </div>
            </div>
          </div>
        </section>

        <div className="relative mt-4 flex flex-1 flex-col items-center justify-center rounded-lg border border-slate-700 bg-slate-800 px-6 py-12 text-center">
          <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

          <div
            className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-600 text-3xl font-semibold text-white"
            aria-hidden="true"
          >
            {initials(other?.name) || '?'}
          </div>

          <p className="mt-5 text-sm font-medium text-white">{statusHeadline}</p>
          <p className="mt-1 max-w-sm text-xs text-slate-400">{statusHint}</p>

          {callStatus === 'connected' && (
            <p className="mt-4 text-xs text-slate-300">
              Microphone {micEnabled ? 'on' : 'muted'}
            </p>
          )}
        </div>

        {(isError || isTerminal) && (
          <div
            className={`mt-4 rounded-md border px-4 py-3 text-sm ${
              isError
                ? 'border-red-500/40 bg-red-950/60 text-red-100'
                : 'border-slate-600 bg-slate-800 text-slate-200'
            }`}
          >
            <p className="font-medium">
              {isError
                ? MEDIA_ERROR_TEXT[errorType] || errorMessage || 'The call could not continue.'
                : callStatus === 'peer-left'
                  ? 'The other participant left the consultation.'
                  : 'The consultation has ended.'}
            </p>
            {isError && errorMessage && (
              <p className="mt-1 text-xs opacity-80">{errorMessage}</p>
            )}
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={toggleMic}
            className={`rounded-md px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50 ${
              micEnabled
                ? 'border border-slate-500 text-slate-100 hover:bg-slate-700'
                : 'bg-amber-500 text-white hover:bg-amber-600'
            }`}
            disabled={controlsDisabled}
          >
            {micEnabled ? 'Mute microphone' : 'Unmute microphone'}
          </button>

          {isError && (
            <button
              type="button"
              onClick={retry}
              className="rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700"
            >
              Try again
            </button>
          )}

          <button
            type="button"
            onClick={handleLeave}
            disabled={callStatus === 'ended'}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isTerminal ? 'Back to appointments' : 'End call'}
          </button>
        </div>

        <p className="mt-3 text-center text-[11px] text-slate-500">
          Audio is peer-to-peer. If the connection is poor, your network may block direct
          media and require a TURN relay.
        </p>
      </div>
    </div>
  )
}
