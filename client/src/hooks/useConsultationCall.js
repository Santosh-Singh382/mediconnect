import { useCallback, useEffect, useRef, useState } from 'react'
import { getSocket, disconnectSocket } from '../lib/socket.js'
import { getRtcConfiguration } from '../lib/webrtcConfig.js'

const ACK_TIMEOUT_MS = 8000

// Browser media errors are mapped to stable UI states so the page can explain
// exactly what went wrong (permission, missing camera/mic, insecure context…).
function mediaError(type, message) {
  const error = new Error(message)
  error.mediaType = type
  return error
}

function classifyMediaError(error, mediaType) {
  const isAudio = mediaType === 'audio'
  const name = error && error.name
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return mediaError(
      'permission-denied',
      isAudio
        ? 'Microphone permission was denied. Allow access in your browser and try again.'
        : 'Camera and microphone permission was denied. Allow access in your browser and try again.',
    )
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return mediaError(
      'device-unavailable',
      isAudio
        ? 'Your microphone is already in use by another application.'
        : 'Your camera or microphone is already in use by another application.',
    )
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError' || name === 'OverconstrainedError') {
    return mediaError(
      'device-unavailable',
      isAudio
        ? 'No microphone was found on this device. Please connect or enable a microphone and try again.'
        : 'No camera or microphone was found on this device.',
    )
  }
  return mediaError(
    'media',
    isAudio
      ? 'Your microphone could not be started.'
      : 'Your camera and microphone could not be started.',
  )
}

async function probeAvailableDevices() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices()
    return {
      camera: devices.some((device) => device.kind === 'videoinput'),
      microphone: devices.some((device) => device.kind === 'audioinput'),
    }
  } catch {
    return { camera: true, microphone: true }
  }
}

async function acquireLocalMedia(mediaType) {
  const isAudio = mediaType === 'audio'

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw mediaError(
      'unsupported',
      isAudio
        ? 'This browser does not support microphone access.'
        : 'This browser does not support camera and microphone access.',
    )
  }
  if (typeof window !== 'undefined' && window.isSecureContext === false) {
    throw mediaError(
      'insecure-context',
      isAudio
        ? 'Microphone access requires a secure (HTTPS or localhost) connection.'
        : 'Camera and microphone access requires a secure (HTTPS or localhost) connection.',
    )
  }

  try {
    return await navigator.mediaDevices.getUserMedia(
      isAudio ? { audio: true, video: false } : { video: true, audio: true },
    )
  } catch (error) {
    const classified = classifyMediaError(error, mediaType)
    if (classified.mediaType === 'device-unavailable') {
      const available = await probeAvailableDevices()
      if (isAudio) {
        if (!available.microphone) {
          throw mediaError(
            'microphone-unavailable',
            'No microphone was found on this device. Please connect or enable a microphone and try again.',
          )
        }
      } else {
        if (!available.camera && available.microphone) {
          throw mediaError('camera-unavailable', 'No camera was found on this device.')
        }
        if (!available.microphone && available.camera) {
          throw mediaError(
            'microphone-unavailable',
            'No microphone was found on this device. Please connect or enable a microphone and try again.',
          )
        }
      }
    }
    throw classified
  }
}

function emitAck(socket, event, payload, timeoutMs = ACK_TIMEOUT_MS) {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve({ ok: false, code: 'TIMEOUT' }), timeoutMs)
    socket.emit(event, payload, (response) => {
      clearTimeout(timer)
      resolve(response || { ok: false, code: 'REALTIME_ERROR' })
    })
  })
}

// Manages a single one-to-one real-time consultation (video or audio) for an
// appointment. Both methods share identical signaling; only the requested media
// and the Socket.IO channel name differ. Signaling runs over the shared
// Socket.IO connection; media never leaves the browser except peer-to-peer.
// Every resource is cleaned up idempotently.
export function useConsultationCall({
  appointmentId,
  enabled = false,
  userId = null,
  mediaType = 'video',
} = {}) {
  const channel = mediaType === 'audio' ? 'audio' : 'video'
  const kindLabel = channel === 'audio' ? 'audio consultation' : 'video consultation'

  const [status, setStatus] = useState('idle')
  const [errorType, setErrorType] = useState(null)
  const [errorMessage, setErrorMessage] = useState(null)
  const [localStream, setLocalStream] = useState(null)
  const [remoteStream, setRemoteStream] = useState(null)
  const [peerPresent, setPeerPresent] = useState(false)
  const [micEnabled, setMicEnabled] = useState(true)
  const [cameraEnabled, setCameraEnabled] = useState(true)
  const [attempt, setAttempt] = useState(0)

  const socketRef = useRef(null)
  const pcRef = useRef(null)
  const localStreamRef = useRef(null)
  const remoteStreamRef = useRef(null)
  const pendingCandidatesRef = useRef([])
  const remoteDescSetRef = useRef(false)
  const endedRef = useRef(false)
  const sessionRef = useRef(null)

  useEffect(() => {
    if (!enabled || !appointmentId || !userId) {
      return undefined
    }

    let active = true
    endedRef.current = false
    pendingCandidatesRef.current = []
    remoteDescSetRef.current = false

    const isActive = () => active

    function fail(type, message) {
      if (!isActive()) return
      setStatus('error')
      setErrorType(type)
      setErrorMessage(message)
    }

    function ensurePeerConnection() {
      if (pcRef.current) {
        return pcRef.current
      }
      const pc = new RTCPeerConnection(getRtcConfiguration())
      pcRef.current = pc

      const stream = localStreamRef.current
      if (stream) {
        stream.getTracks().forEach((track) => pc.addTrack(track, stream))
      }

      pc.ontrack = (event) => {
        let incoming = event.streams && event.streams[0]
        if (!incoming) {
          incoming = remoteStreamRef.current || new MediaStream()
          incoming.addTrack(event.track)
        }
        remoteStreamRef.current = incoming
        if (isActive()) setRemoteStream(incoming)
      }

      pc.onicecandidate = (event) => {
        if (event.candidate && socketRef.current) {
          socketRef.current.emit(`${channel}:ice-candidate`, {
            appointmentId,
            candidate: event.candidate,
          })
        }
      }

      pc.onconnectionstatechange = () => {
        if (!isActive() || endedRef.current) return
        const state = pc.connectionState
        if (state === 'connected') {
          setStatus('connected')
        } else if (state === 'connecting') {
          setStatus('connecting')
        } else if (state === 'disconnected') {
          setStatus('reconnecting')
        } else if (state === 'failed') {
          setStatus('reconnecting')
          try {
            pc.restartIce()
          } catch {
            // restartIce is best-effort.
          }
        }
      }

      pc.oniceconnectionstatechange = () => {
        if (!isActive() || endedRef.current) return
        const state = pc.iceConnectionState
        if (state === 'connected' || state === 'completed') {
          setStatus('connected')
        } else if (state === 'failed') {
          setStatus('reconnecting')
        }
      }

      return pc
    }

    async function flushCandidates(pc) {
      const queued = pendingCandidatesRef.current
      pendingCandidatesRef.current = []
      for (const candidate of queued) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate))
        } catch {
          // A single bad candidate must not abort the call.
        }
      }
    }

    async function handleReady() {
      if (!isActive() || endedRef.current) return
      setPeerPresent(true)
      setStatus('connecting')
      const pc = ensurePeerConnection()
      try {
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        socketRef.current.emit(`${channel}:offer`, {
          appointmentId,
          sdp: pc.localDescription,
        })
      } catch {
        fail('media', `Could not start the ${kindLabel}. Please retry.`)
      }
    }

    async function handleOffer(payload) {
      if (!isActive() || endedRef.current || !payload || !payload.sdp) return
      setPeerPresent(true)
      setStatus('connecting')
      const pc = ensurePeerConnection()
      try {
        if (pc.signalingState === 'have-local-offer') {
          return
        }
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        remoteDescSetRef.current = true
        await flushCandidates(pc)
        const answer = await pc.createAnswer()
        await pc.setLocalDescription(answer)
        socketRef.current.emit(`${channel}:answer`, {
          appointmentId,
          sdp: pc.localDescription,
        })
      } catch {
        fail('media', `Could not answer the ${kindLabel}. Please retry.`)
      }
    }

    async function handleAnswer(payload) {
      if (!isActive() || !payload || !payload.sdp) return
      const pc = pcRef.current
      if (!pc) return
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp))
        remoteDescSetRef.current = true
        await flushCandidates(pc)
      } catch {
        fail('media', `Could not complete the ${kindLabel}. Please retry.`)
      }
    }

    async function handleIce(payload) {
      if (!isActive() || !payload || !payload.candidate) return
      const pc = pcRef.current
      if (pc && remoteDescSetRef.current) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(payload.candidate))
        } catch {
          // Ignore a candidate that arrived slightly out of order.
        }
      } else {
        pendingCandidatesRef.current.push(payload.candidate)
      }
    }

    function handlePeerLeave() {
      if (!isActive() || endedRef.current) return
      setPeerPresent(false)
      setStatus('peer-left')
    }

    function handlePeerEnd() {
      if (!isActive()) return
      endedRef.current = true
      setPeerPresent(false)
      setStatus('ended')
      teardownPeerConnection()
      stopLocalTracks()
      setLocalStream(null)
    }

    async function join() {
      const socket = socketRef.current
      if (!socket) return
      try {
        const response = await emitAck(socket, `${channel}:join`, { appointmentId })
        if (!isActive()) return
        if (!response || response.ok === false) {
          const code = response && response.code
          const type =
            code === 'ROOM_FULL'
              ? 'room-full'
              : code === `${channel.toUpperCase()}_NOT_AVAILABLE`
                ? 'unavailable'
                : code === 'CONSULTATION_TYPE_MISMATCH'
                  ? 'type-mismatch'
                  : code === 'FORBIDDEN'
                    ? 'forbidden'
                    : 'socket'
          fail(type, (response && response.message) || 'Unable to join the consultation.')
          return
        }
        if (response.role === 'waiting') {
          setStatus('waiting')
          setPeerPresent(false)
        } else {
          setPeerPresent(true)
          setStatus('connecting')
          ensurePeerConnection()
        }
      } catch {
        fail('socket', 'Unable to join the consultation.')
      }
    }

    function handleConnect() {
      if (!isActive()) return
      setErrorType(null)
      setErrorMessage(null)
      join()
    }

    function handleDisconnect() {
      if (!isActive() || endedRef.current) return
      setStatus('reconnecting')
    }

    function handleConnectError() {
      if (!isActive() || endedRef.current) return
      setStatus('reconnecting')
    }

    function teardownPeerConnection() {
      const pc = pcRef.current
      if (pc) {
        pc.ontrack = null
        pc.onicecandidate = null
        pc.onconnectionstatechange = null
        pc.oniceconnectionstatechange = null
        try {
          pc.close()
        } catch {
          // Already closed.
        }
        pcRef.current = null
      }
      if (remoteStreamRef.current) {
        remoteStreamRef.current.getTracks().forEach((track) => track.stop())
        remoteStreamRef.current = null
      }
      setRemoteStream(null)
    }

    function stopLocalTracks() {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((track) => track.stop())
        localStreamRef.current = null
      }
    }

    function cleanup() {
      const socket = socketRef.current
      if (socket) {
        socket.off('connect', handleConnect)
        socket.off('disconnect', handleDisconnect)
        socket.off('connect_error', handleConnectError)
        socket.off(`${channel}:ready`, handleReady)
        socket.off(`${channel}:offer`, handleOffer)
        socket.off(`${channel}:answer`, handleAnswer)
        socket.off(`${channel}:ice-candidate`, handleIce)
        socket.off(`${channel}:leave`, handlePeerLeave)
        socket.off(`${channel}:end`, handlePeerEnd)
      }
      teardownPeerConnection()
      stopLocalTracks()
      pendingCandidatesRef.current = []
      remoteDescSetRef.current = false
      disconnectSocket()
      socketRef.current = null
    }

    function end() {
      if (endedRef.current) return
      const socket = socketRef.current
      endedRef.current = true
      if (socket && socket.connected) {
        socket.emit(`${channel}:end`, { appointmentId })
      }
      cleanup()
      if (isActive()) {
        setPeerPresent(false)
        setLocalStream(null)
        setStatus('ended')
      }
    }

    async function start() {
      setStatus('requesting-media')
      setErrorType(null)
      setErrorMessage(null)

      let stream
      try {
        stream = await acquireLocalMedia(channel)
      } catch (error) {
        stopLocalTracks()
        if (error && error.mediaType) {
          fail(error.mediaType, error.message)
        } else {
          fail('media', `Your ${channel === 'audio' ? 'microphone' : 'camera and microphone'} could not be started.`)
        }
        return
      }
      if (!isActive()) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      localStreamRef.current = stream
      setLocalStream(stream)
      setMicEnabled(stream.getAudioTracks().some((track) => track.enabled))
      setCameraEnabled(stream.getVideoTracks().some((track) => track.enabled))
      setStatus('waiting')

      const socket = getSocket()
      if (!socket) {
        fail('socket', 'You are not signed in.')
        return
      }
      socketRef.current = socket
      socket.on('connect', handleConnect)
      socket.on('disconnect', handleDisconnect)
      socket.on('connect_error', handleConnectError)
      socket.on(`${channel}:ready`, handleReady)
      socket.on(`${channel}:offer`, handleOffer)
      socket.on(`${channel}:answer`, handleAnswer)
      socket.on(`${channel}:ice-candidate`, handleIce)
      socket.on(`${channel}:leave`, handlePeerLeave)
      socket.on(`${channel}:end`, handlePeerEnd)

      if (socket.connected) {
        handleConnect()
      }
    }

    sessionRef.current = { end }

    start()

    return () => {
      active = false
      sessionRef.current = null
      if (!endedRef.current) {
        const socket = socketRef.current
        if (socket && socket.connected) {
          socket.emit(`${channel}:leave`, { appointmentId })
        }
      }
      cleanup()
      setLocalStream(null)
      setRemoteStream(null)
      setPeerPresent(false)
    }
  }, [enabled, appointmentId, userId, attempt, channel, kindLabel])

  // Muting and camera on/off only toggle the existing track's `enabled` flag;
  // the device is never reacquired on each toggle. The track stays attached to
  // any active peer connection, so the peer perceives the change immediately
  // without a new negotiation.
  useEffect(() => {
    const stream = localStreamRef.current
    if (!stream) return
    stream.getAudioTracks().forEach((track) => {
      track.enabled = micEnabled
    })
    stream.getVideoTracks().forEach((track) => {
      track.enabled = cameraEnabled
    })
  }, [micEnabled, cameraEnabled, localStream])

  const toggleMic = useCallback(() => {
    setMicEnabled((value) => !value)
  }, [])

  const toggleCamera = useCallback(() => {
    setCameraEnabled((value) => !value)
  }, [])

  const endCall = useCallback(() => {
    if (sessionRef.current) {
      sessionRef.current.end()
    }
  }, [])

  const retry = useCallback(() => {
    setStatus('idle')
    setErrorType(null)
    setErrorMessage(null)
    setAttempt((value) => value + 1)
  }, [])

  return {
    status,
    errorType,
    errorMessage,
    localStream,
    remoteStream,
    peerPresent,
    micEnabled,
    cameraEnabled,
    toggleMic,
    toggleCamera,
    endCall,
    retry,
  }
}
