import { type NextRequest, NextResponse } from 'next/server'
import { failCapture, fulfillCapture } from '@/lib/capture-bus'
import {
  guardSceneApiRequest,
  sceneApiJson,
  sceneApiPreflight,
  withSceneApiHeaders,
} from '@/lib/scene-api-security'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type RouteParams = { params: Promise<{ id: string; captureId: string }> }

const MAX_BYTES = 12 * 1024 * 1024 // 12 MiB ceiling on the encoded PNG

export function OPTIONS(request: NextRequest) {
  return sceneApiPreflight(request)
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const guard = guardSceneApiRequest(request)
  if (guard) return guard

  const { captureId } = await params
  const errHeader = request.headers.get('x-pascal-capture-error')
  if (errHeader) {
    const settled = failCapture(captureId, errHeader)
    return withSceneApiHeaders(
      request,
      new NextResponse(null, { status: settled ? 204 : 410 }),
    )
  }

  const buf = Buffer.from(await request.arrayBuffer())
  if (buf.byteLength === 0) {
    return sceneApiJson(request, { error: 'empty_body' }, { status: 400 })
  }
  if (buf.byteLength > MAX_BYTES) {
    return sceneApiJson(request, { error: 'payload_too_large' }, { status: 413 })
  }
  const settled = fulfillCapture(captureId, buf)
  return withSceneApiHeaders(
    request,
    new NextResponse(null, { status: settled ? 204 : 410 }),
  )
}
