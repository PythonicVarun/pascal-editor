import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { resolveDefaultDatabasePath } from '../storage'
import { ErrorCode, throwMcpError } from './errors'

export const captureViewerInput = {
  view: z
    .enum(['current', 'top', 'front', 'iso', 'perspective'])
    .default('current')
    .describe(
      "Camera angle. 'current' = whatever the user is looking at; 'top'/'front'/'iso' = orthographic presets; 'perspective' = 3/4 perspective view.",
    ),
}

export const captureViewerOutput = {
  view: z.string(),
  bytes: z.number(),
}

function resolveAgentToken(): string | null {
  const env = process.env
  const explicit = env.PASCAL_AGENT_TOKEN_PATH
  const file =
    explicit && explicit.length > 0
      ? explicit
      : path.join(path.dirname(resolveDefaultDatabasePath(env)), 'agent.token')
  try {
    const raw = readFileSync(file, 'utf8').trim()
    return raw.length > 0 ? raw : null
  } catch {
    return null
  }
}

export function registerCaptureViewer(server: McpServer): void {
  server.registerTool(
    'capture_viewer',
    {
      title: 'Capture viewer',
      description:
        "Return a PNG of the user's live 3D viewer so you can see what you just built. Requires the editor tab to be open on the scene named by PASCAL_SCENE_ID. Use this after any mutation tool to verify the result visually.",
      inputSchema: captureViewerInput,
      outputSchema: captureViewerOutput,
    },
    async ({ view }) => {
      const sceneId = process.env.PASCAL_SCENE_ID
      if (!sceneId) {
        throwMcpError(
          ErrorCode.InvalidParams,
          'PASCAL_SCENE_ID is not set; capture_viewer requires a scene context.',
        )
      }
      const editorUrl = (process.env.PASCAL_EDITOR_URL ?? 'http://host.docker.internal:3002').replace(
        /\/+$/,
        '',
      )
      const token = resolveAgentToken()
      if (!token) {
        throwMcpError(
          ErrorCode.InternalError,
          'Agent token not found. The editor must boot at least once with PASCAL_DATA_DIR set so agent.token is written next to the SQLite database.',
        )
      }

      const url = `${editorUrl}/api/scenes/${encodeURIComponent(sceneId)}/capture`
      let res: Response
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-pascal-scene-token': token,
          },
          body: JSON.stringify({ view }),
        })
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        throwMcpError(
          ErrorCode.InternalError,
          `Unable to reach editor at ${editorUrl}: ${message}. Set PASCAL_EDITOR_URL if the editor is not at the default host.docker.internal:3002.`,
        )
      }

      if (!res.ok) {
        let body: string
        try {
          body = await res.text()
        } catch {
          body = ''
        }
        if (res.status === 503) {
          throwMcpError(
            ErrorCode.InternalError,
            'No editor tab is currently rendering this scene. Open /agent/' +
              sceneId +
              ' in a browser and retry.',
          )
        }
        if (res.status === 504) {
          throwMcpError(
            ErrorCode.InternalError,
            'Editor accepted the capture request but the browser did not upload a frame in time.',
          )
        }
        throwMcpError(
          ErrorCode.InternalError,
          `capture_viewer failed: ${res.status} ${res.statusText} ${body}`,
        )
      }

      const buf = Buffer.from(await res.arrayBuffer())
      const data = buf.toString('base64')
      const payload = { view, bytes: buf.byteLength }
      return {
        content: [
          { type: 'image' as const, data, mimeType: 'image/png' },
          { type: 'text' as const, text: JSON.stringify(payload) },
        ],
        structuredContent: payload,
      }
    },
  )
}
