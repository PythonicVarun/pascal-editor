import { type NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requestCapture, subscriberCount } from '@/lib/capture-bus'
import {
  guardSceneApiRequest,
  sceneApiJson,
  sceneApiPreflight,
  withSceneApiHeaders,
} from '@/lib/scene-api-security'
import { getSceneOperations } from '@/lib/scene-store-server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string }> }

const captureSchema = z.object({
  view: z
    .enum(['current', 'top', 'front', 'iso', 'perspective'])
    .default('current'),
})

export function OPTIONS(request: NextRequest) {
  return sceneApiPreflight(request)
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard

  const { id } = await params
  const operations = await getSceneOperations()
  const scene = await operations.loadStoredScene(id)
  if (!scene) {
    return sceneApiJson(request, { error: 'not_found' }, { status: 404 })
  }

  if (subscriberCount(id) === 0) {
    return sceneApiJson(
      request,
      { error: 'editor_not_connected', message: 'No browser tab is rendering this scene.' },
      { status: 503 },
    )
  }

  let body: z.infer<typeof captureSchema>
  try {
    const json = (await request.json()) as unknown
    body = captureSchema.parse(json)
  } catch (err) {
    return sceneApiJson(
      request,
      { error: 'invalid_request', message: err instanceof Error ? err.message : 'invalid body' },
      { status: 400 },
    )
  }

  try {
    const png = await requestCapture(id, body.view)
    const response = new NextResponse(new Uint8Array(png), {
      status: 200,
      headers: {
        'Content-Type': 'image/png',
        'Content-Length': String(png.byteLength),
        'Cache-Control': 'no-store',
      },
    })
    return withSceneApiHeaders(request, response)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'capture_failed'
    const status = message === 'capture_timeout' ? 504 : 502
    return sceneApiJson(request, { error: message }, { status })
  }
}
