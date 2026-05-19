// Process-scoped bridge between the editor's SSE handler and the live R3F
// canvas: <CaptureMount/> registers a capturer when it mounts, the editor
// calls captureViewer(view) and gets back a PNG Blob of whatever the user
// is currently seeing. Module-scope is fine — there is only ever one viewer
// canvas mounted in the editor app at a time.

export type ViewPreset = 'current' | 'top' | 'front' | 'iso' | 'perspective'

type Capturer = (view: ViewPreset) => Promise<Blob>

let activeCapturer: Capturer | null = null

export function setCapturer(capturer: Capturer | null): void {
  activeCapturer = capturer
}

export function captureViewer(view: ViewPreset): Promise<Blob> {
  const capturer = activeCapturer
  if (!capturer) {
    return Promise.reject(new Error('viewer_not_mounted'))
  }
  return capturer(view)
}

export function isViewerMounted(): boolean {
  return activeCapturer !== null
}
