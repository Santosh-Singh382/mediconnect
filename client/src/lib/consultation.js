// Shared presentation rules for consultation methods. The appointment type
// chosen at booking time (VIDEO / AUDIO / CHAT) decides which single action is
// offered; the backend independently enforces the same rule.

export const CONSULTATION_ACCESS_STATUSES = ['CONFIRMED']

// Media/permission failures are mapped to the same human-readable text for both
// the video and audio consultation pages.
export const MEDIA_ERROR_TEXT = {
  'permission-denied': 'Camera and microphone permission was denied.',
  'camera-unavailable': 'No camera is available on this device.',
  'microphone-unavailable':
    'No microphone was found on this device. Please connect or enable a microphone and try again.',
  'device-unavailable': 'Your camera or microphone is unavailable.',
  'insecure-context': 'Camera and microphone require a secure (HTTPS or localhost) connection.',
  unsupported: 'This browser does not support camera and microphone access.',
  'room-full': 'This consultation already has two participants.',
  'type-mismatch': 'This consultation method is not available for this appointment.',
  forbidden: 'You do not have access to this consultation.',
  unavailable: 'This consultation is only available for confirmed appointments.',
  socket: 'The connection to the consultation server was lost.',
  media: 'The consultation could not be started.',
}

export function consultationStatusMeta(status) {
  switch (status) {
    case 'requesting-media':
      return { label: 'Requesting media access…', tone: 'bg-amber-100 text-amber-800' }
    case 'waiting':
      return { label: 'Waiting for the other participant…', tone: 'bg-amber-100 text-amber-800' }
    case 'connecting':
      return { label: 'Connecting…', tone: 'bg-blue-100 text-blue-800' }
    case 'connected':
      return { label: 'Connected', tone: 'bg-green-100 text-green-800' }
    case 'reconnecting':
      return { label: 'Reconnecting…', tone: 'bg-amber-100 text-amber-800' }
    case 'peer-left':
      return { label: 'Participant disconnected', tone: 'bg-slate-200 text-slate-700' }
    case 'ended':
      return { label: 'Call ended', tone: 'bg-slate-200 text-slate-700' }
    case 'error':
      return { label: 'Call error', tone: 'bg-red-100 text-red-800' }
    default:
      return { label: 'Preparing…', tone: 'bg-slate-200 text-slate-700' }
  }
}

const ACTION_STYLES = {
  video: 'bg-emerald-600 hover:bg-emerald-700',
  audio: 'bg-indigo-600 hover:bg-indigo-700',
  chat: 'bg-brand-600 hover:bg-brand-700',
}

function buildAction(kind, label, appointmentId) {
  return {
    kind,
    label,
    to: `/appointments/${appointmentId}/${kind}`,
    className: `rounded-md px-3 py-1.5 text-sm font-medium text-white transition ${ACTION_STYLES[kind]}`,
  }
}

// Returns the single consultation action for an appointment, or null when no
// method is available (pending / cancelled / rejected, non-chat completed).
export function consultationActionFor(appointment) {
  if (!appointment) return null
  const { id, type, status } = appointment

  if (status === 'CONFIRMED') {
    if (type === 'VIDEO') return buildAction('video', 'Start Video Consultation', id)
    if (type === 'AUDIO') return buildAction('audio', 'Start Audio Consultation', id)
    if (type === 'CHAT') return buildAction('chat', 'Open Chat', id)
    return null
  }

  if (status === 'COMPLETED' && type === 'CHAT') {
    return buildAction('chat', 'View Chat', id)
  }

  return null
}

// Message shown when a participant opens the wrong consultation method for an
// appointment. Mirrors the wording the backend returns.
export function wrongConsultationTypeMessage(appointmentType, requestedMethod) {
  return `This appointment was booked as ${appointmentType} consultation. ${requestedMethod} consultation is not available for this appointment.`
}
