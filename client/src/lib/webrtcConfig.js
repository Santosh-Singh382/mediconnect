// ICE configuration for the peer connection.
//
// WebRTC is peer-to-peer and free. To traverse NAT/firewall it uses STUN and,
// when a direct path is impossible, TURN relays. The defaults below use a
// PUBLIC STUN server that is suitable for local development and demos only; it
// does NOT guarantee connectivity on every network.
//
// To supply your own STUN/TURN servers (for example a self-hosted coturn),
// set VITE_ICE_SERVERS to a JSON array, e.g.:
//   VITE_ICE_SERVERS=[{"urls":"stun:stun.example.org:3478"},{"urls":"turn:turn.example.org:3478","username":"user","credential":"secret"}]
// Never commit private TURN credentials to the repository.

const DEFAULT_ICE_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }]

function parseConfiguredServers(raw) {
  if (!raw) {
    return null
  }
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed
    }
  } catch {
    // Fall through to the development default.
  }
  return null
}

export function getRtcConfiguration() {
  const configured = parseConfiguredServers(import.meta.env.VITE_ICE_SERVERS)
  return {
    iceServers: configured || DEFAULT_ICE_SERVERS,
  }
}

export const usingDefaultIceServers = () =>
  parseConfiguredServers(import.meta.env.VITE_ICE_SERVERS) === null
