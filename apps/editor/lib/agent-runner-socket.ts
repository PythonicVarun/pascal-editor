import { io, type Socket } from 'socket.io-client'
import { AGENT_RUNNER_URL } from './agent-runner-client'

export interface FsEvent {
  /** "add" | "addDir" | "change" | "unlink" | "unlinkDir" — chokidar event names. */
  type: string
  projectId: string
  path: string
}

let cached: Socket | null = null

function getSocket(): Socket {
  if (cached) return cached
  cached = io(AGENT_RUNNER_URL, {
    path: '/socket.io',
    transports: ['websocket', 'polling'],
    autoConnect: true,
  })
  return cached
}

/**
 * Subscribe to fs:event messages for one project. Returns an unsubscribe
 * function — call it on cleanup so the listener doesn't leak.
 */
export function subscribeFsEvents(
  projectId: string,
  onEvent: (ev: FsEvent) => void,
): () => void {
  const socket = getSocket()
  const handler = (ev: FsEvent) => {
    if (ev.projectId === projectId) onEvent(ev)
  }
  socket.on('fs:event', handler)

  const subscribe = () => socket.emit('project:subscribe', projectId)
  if (socket.connected) subscribe()
  else socket.once('connect', subscribe)

  return () => {
    socket.off('fs:event', handler)
    socket.emit('project:unsubscribe', projectId)
  }
}
