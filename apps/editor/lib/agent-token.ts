// Long-lived shared secret between the editor server and any Pascal MCP
// instance running inside an agent container. Written once to
// ${PASCAL_DATA_DIR}/agent.token (mode 0600); the container reads it via its
// existing SQLite bind mount and sends it as `x-pascal-scene-token` on
// /api/scenes/* calls so the security layer accepts host.docker.internal
// requests without exposing PASCAL_SCENE_API_TOKEN.

import { randomBytes } from 'node:crypto'
import { openSync, readFileSync, writeSync, closeSync } from 'node:fs'
import path from 'node:path'
import { resolveDefaultDatabasePath } from '@pascal-app/mcp/storage'

let cached: string | null | undefined

function resolveTokenPath(): string {
  const env = process.env
  if (env.PASCAL_AGENT_TOKEN_PATH && env.PASCAL_AGENT_TOKEN_PATH.length > 0) {
    return env.PASCAL_AGENT_TOKEN_PATH
  }
  // Mirror the SQLite DB's parent directory so the file rides along on the
  // same bind mount the container already has.
  const dbPath = resolveDefaultDatabasePath(env)
  return path.join(path.dirname(dbPath), 'agent.token')
}

/**
 * Read the agent token, creating it on first call. Returns null only if the
 * directory cannot be written to (read-only mount, permission denied) — the
 * caller must then disable token-based auth.
 */
export function getAgentToken(): string | null {
  if (cached !== undefined) return cached
  const file = resolveTokenPath()
  try {
    // Atomic create: O_CREAT|O_EXCL. If the file already exists we fall
    // through to a plain read.
    let fd: number
    try {
      fd = openSync(file, 'wx', 0o600)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') {
        cached = readFileSync(file, 'utf8').trim() || null
        return cached
      }
      throw err
    }
    const token = randomBytes(32).toString('hex')
    writeSync(fd, token)
    closeSync(fd)
    cached = token
    return cached
  } catch (err) {
    console.error('[agent-token] failed to create token at', file, err)
    return null
  }
}
