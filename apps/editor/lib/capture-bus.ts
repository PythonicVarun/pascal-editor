// Per-scene in-memory pub/sub for "capture viewer" requests.
//
// The capture POST handler mints a captureId and broadcasts to every open SSE
// subscriber on that scene (each subscriber is a per-client enqueue callback
// registered by the /events route). The browser captures and uploads to the
// PUT route, which calls fulfillCapture — first writer wins.
//
// HMR resets module state in dev. We stash the maps on globalThis so an
// in-flight capture survives a route reload.

import { randomUUID } from 'node:crypto'

export type ViewPreset = 'current' | 'top' | 'front' | 'iso' | 'perspective'

export interface CaptureRequest {
  captureId: string
  view: ViewPreset
}

type Subscriber = (req: CaptureRequest) => void

interface Pending {
  sceneId: string
  resolve: (png: Buffer) => void
  reject: (err: Error) => void
  timer: NodeJS.Timeout
}

interface BusState {
  pending: Map<string, Pending>
  subscribers: Map<string, Set<Subscriber>>
}

const GLOBAL_KEY = '__pascalCaptureBus__'
const g = globalThis as unknown as Record<string, BusState | undefined>

function getState(): BusState {
  if (!g[GLOBAL_KEY]) {
    g[GLOBAL_KEY] = { pending: new Map(), subscribers: new Map() }
  }
  return g[GLOBAL_KEY]!
}

export function subscribe(sceneId: string, fn: Subscriber): () => void {
  const state = getState()
  let set = state.subscribers.get(sceneId)
  if (!set) {
    set = new Set()
    state.subscribers.set(sceneId, set)
  }
  set.add(fn)
  return () => {
    const s = state.subscribers.get(sceneId)
    if (!s) return
    s.delete(fn)
    if (s.size === 0) state.subscribers.delete(sceneId)
  }
}

export function subscriberCount(sceneId: string): number {
  return getState().subscribers.get(sceneId)?.size ?? 0
}

export function requestCapture(
  sceneId: string,
  view: ViewPreset,
  timeoutMs = 10_000,
): Promise<Buffer> {
  const state = getState()
  const captureId = randomUUID()
  return new Promise<Buffer>((resolve, reject) => {
    const timer = setTimeout(() => {
      if (state.pending.delete(captureId)) {
        reject(new Error('capture_timeout'))
      }
    }, timeoutMs)
    state.pending.set(captureId, { sceneId, resolve, reject, timer })
    const subs = state.subscribers.get(sceneId)
    if (!subs || subs.size === 0) {
      clearTimeout(timer)
      state.pending.delete(captureId)
      reject(new Error('editor_not_connected'))
      return
    }
    const req: CaptureRequest = { captureId, view }
    // Copy to a list so a subscriber removing itself mid-iteration is fine.
    for (const fn of Array.from(subs)) {
      try {
        fn(req)
      } catch {
        // A misbehaving subscriber doesn't break the broadcast.
      }
    }
  })
}

/**
 * Resolve a pending capture. Returns true on first call, false on every
 * subsequent call so duplicate uploads from multiple browser tabs get a 410.
 */
export function fulfillCapture(captureId: string, png: Buffer): boolean {
  const state = getState()
  const entry = state.pending.get(captureId)
  if (!entry) return false
  state.pending.delete(captureId)
  clearTimeout(entry.timer)
  entry.resolve(png)
  return true
}

/** Reject a pending capture (e.g., the browser failed to encode the canvas). */
export function failCapture(captureId: string, message: string): boolean {
  const state = getState()
  const entry = state.pending.get(captureId)
  if (!entry) return false
  state.pending.delete(captureId)
  clearTimeout(entry.timer)
  entry.reject(new Error(message))
  return true
}
