import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth.js'
import { useChatSocket } from '../hooks/useChatSocket.js'
import AppHeader from '../components/AppHeader.jsx'
import LoadingState from '../components/LoadingState.jsx'
import ErrorState from '../components/ErrorState.jsx'
import AppointmentStatusBadge from '../components/AppointmentStatusBadge.jsx'
import { getAppointment } from '../lib/appointmentApi.js'
import {
  getChatMessages,
  sendChatMessage,
  markChatMessagesRead,
} from '../lib/chatApi.js'
import { getApiErrorMessage } from '../lib/apiError.js'
import { homePathFor, homeLinksFor } from '../lib/homePath.js'
import { formatAppointmentDate, formatTimeRange, typeLabel } from '../lib/appointmentFormat.js'
import { wrongConsultationTypeMessage } from '../lib/consultation.js'

const MAX_MESSAGE_LENGTH = 2000
const CHAT_ACCESS_STATUSES = ['CONFIRMED', 'COMPLETED']

function initials(name) {
  return (name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase()
}

function formatClock(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function formatDayLabel(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
}

function dayKey(iso) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

function sortMessages(messages) {
  return [...messages].sort((a, b) => {
    const byTime = String(a.createdAt).localeCompare(String(b.createdAt))
    if (byTime !== 0) return byTime
    return String(a.id).localeCompare(String(b.id))
  })
}

export default function ChatPage() {
  const { appointmentId } = useParams()
  const { user } = useAuth()

  const [appointmentState, setAppointmentState] = useState({
    loading: true,
    error: null,
    appointment: null,
  })
  const [messages, setMessages] = useState([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [actionError, setActionError] = useState(null)

  const seenIdsRef = useRef(new Set())
  const bottomRef = useRef(null)
  const readFlushedRef = useRef(false)

  const appointment = appointmentState.appointment
  const status = appointment ? appointment.status : null
  const appointmentType = appointment ? appointment.type : null
  const isChatType = appointmentType === 'CHAT'
  const canChat = status !== null && isChatType && CHAT_ACCESS_STATUSES.includes(status)
  const canSend = status === 'CONFIRMED'

  const meId = user ? user.id : null

  const addMessages = useCallback((incoming) => {
    const fresh = incoming.filter((message) => {
      if (!message || !message.id) return false
      if (seenIdsRef.current.has(message.id)) return false
      seenIdsRef.current.add(message.id)
      return true
    })
    if (fresh.length === 0) return
    setMessages((current) => sortMessages([...current, ...fresh]))
  }, [])

  const flushRead = useCallback(
    (list) => {
      if (!appointmentId || !meId) return
      const hasUnread = list.some(
        (message) => message.receiverId === meId && !message.isRead,
      )
      if (!hasUnread) return
      markChatMessagesRead(appointmentId).catch(() => {})
      setMessages((current) =>
        current.map((message) =>
          message.receiverId === meId ? { ...message, isRead: true } : message,
        ),
      )
    },
    [appointmentId, meId],
  )

  // Load appointment metadata first, then chat history.
  useEffect(() => {
    let active = true
    seenIdsRef.current = new Set()
    readFlushedRef.current = false

    getAppointment(appointmentId)
      .then((response) => {
        if (!active) return
        const loaded = response.data.data.appointment
        setMessages([])
        setAppointmentState({ loading: false, error: null, appointment: loaded })
        if (!CHAT_ACCESS_STATUSES.includes(loaded.status) || loaded.type !== 'CHAT') {
          return
        }
        setHistoryLoading(true)
        return getChatMessages(appointmentId)
          .then((history) => {
            if (!active) return
            const list = history.data.data.messages || []
            list.forEach((message) => seenIdsRef.current.add(message.id))
            setMessages(sortMessages(list))
            setHistoryLoading(false)
            if (!readFlushedRef.current) {
              readFlushedRef.current = true
              flushRead(list)
            }
          })
          .catch((error) => {
            if (!active) return
            setHistoryLoading(false)
            setHistoryError(
              getApiErrorMessage(error, 'Unable to load the conversation.'),
            )
          })
      })
      .catch((error) => {
        if (!active) return
        setAppointmentState({
          loading: false,
          error: getApiErrorMessage(
            error,
            'This conversation is not available.',
          ),
          appointment: null,
        })
      })

    return () => {
      active = false
    }
  }, [appointmentId, flushRead])

  const handleIncoming = useCallback(
    (message) => {
      if (!message || message.appointmentId !== appointmentId) return
      addMessages([message])
      if (message.receiverId === meId) {
        markChatMessagesRead(appointmentId).catch(() => {})
        setMessages((current) =>
          current.map((item) =>
            item.id === message.id ? { ...item, isRead: true } : item,
          ),
        )
      }
    },
    [appointmentId, meId, addMessages],
  )

  const handleReadReceipt = useCallback(
    (payload) => {
      if (!payload || payload.appointmentId !== appointmentId) return
      if (payload.byUserId === meId) return
      setMessages((current) =>
        current.map((message) =>
          message.senderId === meId ? { ...message, isRead: true } : message,
        ),
      )
    },
    [appointmentId, meId],
  )

  const { connectionState, connectionError, joinRoom, sendMessage, markRead } =
    useChatSocket({
      enabled: Boolean(appointmentId && canChat && meId),
      onMessage: handleIncoming,
      onMessagesRead: handleReadReceipt,
    })

  // Join the authorized appointment room once connected (and after reconnects).
  useEffect(() => {
    if (connectionState !== 'connected' || !appointmentId || !canChat) return
    let active = true
    joinRoom(appointmentId).then((response) => {
      if (!active) return
      if (response && response.ok === false) {
        setActionError(
          response.message || 'You are not able to open this conversation.',
        )
      }
    })
    return () => {
      active = false
    }
  }, [connectionState, appointmentId, canChat, joinRoom])

  // Keep read state in sync with the server once the socket room is joined.
  useEffect(() => {
    if (connectionState !== 'connected' || !appointmentId) return
    const hasUnread = messages.some(
      (message) => message.receiverId === meId && !message.isRead,
    )
    if (hasUnread) {
      markRead(appointmentId).catch(() => {})
    }
  }, [connectionState, appointmentId, messages, meId, markRead])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' })
  }, [messages, historyLoading, appointmentState.loading])

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim()
    if (!trimmed || sending || !canSend) return

    setSending(true)
    setActionError(null)

    try {
      if (connectionState === 'connected') {
        const response = await sendMessage(appointmentId, trimmed)
        if (response.ok && response.message) {
          addMessages([response.message])
          setDraft('')
        } else {
          setActionError(
            response.message || 'Your message could not be sent. Please try again.',
          )
        }
      } else {
        const response = await sendChatMessage(appointmentId, trimmed)
        addMessages([response.data.data.message])
        setDraft('')
      }
    } catch (error) {
      setActionError(getApiErrorMessage(error, 'Your message could not be sent.'))
    } finally {
      setSending(false)
    }
  }, [
    draft,
    sending,
    canSend,
    connectionState,
    appointmentId,
    sendMessage,
    addMessages,
  ])

  function handleKeyDown(event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      handleSend()
    }
  }

  const { other, subtitle } = useMemo(() => {
    if (!appointment) return { other: null, subtitle: '' }
    if (user && user.role === 'DOCTOR') {
      return { other: appointment.patient, subtitle: 'Patient' }
    }
    return {
      other: appointment.doctor,
      subtitle: appointment.doctor.specialization || 'Doctor',
    }
  }, [appointment, user])

  const backTo = user && user.role === 'DOCTOR' ? '/doctor/appointments' : '/appointments'

  if (appointmentState.loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <LoadingState label="Opening conversation…" />
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
            message={appointmentState.error || 'This conversation is not available.'}
          />
          <div className="mt-4 text-center">
            <Link
              to={backTo}
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Back to appointments
            </Link>
          </div>
        </main>
      </div>
    )
  }

  if (appointmentType !== 'CHAT') {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h1 className="text-base font-semibold text-slate-900">
              Chat consultation not available
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              {wrongConsultationTypeMessage(appointmentType, 'Chat')}
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

  if (!canChat) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />
        <main className="mx-auto max-w-3xl px-6 py-10">
          <div className="rounded-lg border border-slate-200 bg-white p-10 text-center shadow-sm">
            <h1 className="text-base font-semibold text-slate-900">
              Chat is not available
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
              Messages can only be exchanged for confirmed appointments. The status
              of this appointment is {status.toLowerCase()}.
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

  const showConnectionNotice =
    connectionState === 'error' || connectionState === 'disconnected'

  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <AppHeader home={homePathFor(user)} links={homeLinksFor(user)} />

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 py-6 sm:px-6 sm:py-10">
        <div className="mb-3">
          <Link
            to={backTo}
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            ← Back to appointments
          </Link>
        </div>

        <section className="flex flex-1 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
          <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
            <div className="flex items-center gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700"
                aria-hidden="true"
              >
                {initials(other?.name)}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  {other?.name || 'Participant'}
                </p>
                <p className="text-xs text-slate-500">{subtitle}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs text-slate-500">
                {formatAppointmentDate(appointment.appointmentDate)} ·{' '}
                {formatTimeRange(appointment.startTime, appointment.endTime)}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                {typeLabel(appointment.type)} consultation
              </p>
              <div className="mt-1 flex justify-end">
                <AppointmentStatusBadge status={appointment.status} />
              </div>
            </div>
          </header>

          {showConnectionNotice && (
            <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800 sm:px-5">
              {connectionError ||
                'Connection lost. Messages will send when the connection is restored.'}
            </p>
          )}

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4 sm:px-5">
            {historyLoading ? (
              <LoadingState label="Loading conversation…" />
            ) : historyError ? (
              <ErrorState message={historyError} />
            ) : messages.length === 0 ? (
              <div className="py-12 text-center">
                <p className="text-sm font-medium text-slate-700">
                  No messages yet
                </p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-slate-500">
                  {canSend
                    ? 'Start the conversation below.'
                    : 'This conversation has no messages.'}
                </p>
              </div>
            ) : (
              messages.map((message, index) => {
                const mine = message.senderId === meId
                const previous = messages[index - 1]
                const showDay =
                  index === 0 ||
                  dayKey(previous.createdAt) !== dayKey(message.createdAt)
                return (
                  <div key={message.id}>
                    {showDay && (
                      <p className="my-2 text-center text-xs font-medium text-slate-400">
                        {formatDayLabel(message.createdAt)}
                      </p>
                    )}
                    <div
                      className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-3.5 py-2 text-sm shadow-sm sm:max-w-[75%] ${
                          mine
                            ? 'rounded-br-sm bg-brand-600 text-white'
                            : 'rounded-bl-sm border border-slate-200 bg-slate-50 text-slate-900'
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">
                          {message.message}
                        </p>
                        <p
                          className={`mt-1 text-right text-[11px] ${
                            mine ? 'text-brand-100' : 'text-slate-400'
                          }`}
                        >
                          {formatClock(message.createdAt)}
                          {mine && message.isRead ? ' · Read' : ''}
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
            <div ref={bottomRef} />
          </div>

          {actionError && (
            <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700 sm:px-5">
              {actionError}
            </p>
          )}

          {canSend ? (
            <div className="border-t border-slate-200 px-4 py-3 sm:px-5">
              <div className="flex items-end gap-3">
                <textarea
                  value={draft}
                  onChange={(event) =>
                    setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))
                  }
                  onKeyDown={handleKeyDown}
                  rows={2}
                  maxLength={MAX_MESSAGE_LENGTH}
                  placeholder="Type your message…"
                  className="block w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={handleSend}
                  disabled={sending || draft.trim().length === 0}
                  className="shrink-0 rounded-md bg-brand-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {sending ? 'Sending…' : 'Send'}
                </button>
              </div>
              <p className="mt-1 text-right text-[11px] text-slate-400">
                {draft.length} / {MAX_MESSAGE_LENGTH}
              </p>
            </div>
          ) : (
            <p className="border-t border-slate-200 px-4 py-3 text-xs text-slate-500 sm:px-5">
              This consultation is complete. You can still review the conversation
              history.
            </p>
          )}
        </section>
      </main>
    </div>
  )
}