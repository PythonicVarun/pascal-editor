// Thin browser client for the agent-runner sidecar (services/agent-runner).
//
// Connects DIRECTLY to NEXT_PUBLIC_AGENT_RUNNER_URL (defaulting to
// http://localhost:4000), bypassing Next.js rewrites — those don't proxy
// WebSocket upgrades, which ttyd and socket.io both need.

export const AGENT_RUNNER_URL =
  process.env.NEXT_PUBLIC_AGENT_RUNNER_URL?.trim() || 'http://localhost:4000'

export const PASCAL_DATA_DIR_HOST =
  process.env.NEXT_PUBLIC_PASCAL_DATA_DIR_HOST?.trim() || ''

export const PASCAL_PROJECT_NAME = 'pascal'

export type AgentKind = 'claude' | 'codex' | 'gemini' | 'copilot' | 'shell'
export const AGENT_KINDS: readonly AgentKind[] = [
  'claude',
  'codex',
  'gemini',
  'copilot',
  'shell',
] as const

export interface Project {
  id: string
  name: string
  slug: string
  path: string
  createdAt: string
  updatedAt: string
}

export interface Session {
  id: string
  projectId: string
  title: string
  agent: AgentKind
  containerStrategy: 'per-session' | 'per-project'
  containerId?: string
  ttydPort?: number
  status: 'creating' | 'running' | 'stopped' | 'error'
  lastError?: string
  agentState?: 'idle' | 'running' | 'restarting' | 'stopped'
  createdAt: string
  updatedAt: string
}

export interface CreateSessionInput {
  title: string
  agent: AgentKind
  containerStrategy: 'per-session' | 'per-project'
  initialPrompt?: string
  containerEnv?: Record<string, string>
  extraMounts?: { hostPath: string; containerPath: string; readOnly?: boolean }[]
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `agent-runner ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function listProjects(): Promise<Project[]> {
  const res = await fetch(`${AGENT_RUNNER_URL}/api/projects`, { cache: 'no-store' })
  return jsonOrThrow<Project[]>(res)
}

export async function createProject(name: string): Promise<Project> {
  const res = await fetch(`${AGENT_RUNNER_URL}/api/projects`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  return jsonOrThrow<Project>(res)
}

/** Get-or-create the shared Pascal project the agent page operates on. */
export async function ensurePascalProject(): Promise<Project> {
  const projects = await listProjects()
  const existing = projects.find((p) => p.name === PASCAL_PROJECT_NAME)
  if (existing) return existing
  return createProject(PASCAL_PROJECT_NAME)
}

export async function listSessions(projectId: string): Promise<Session[]> {
  const res = await fetch(`${AGENT_RUNNER_URL}/api/projects/${projectId}/sessions`, {
    cache: 'no-store',
  })
  return jsonOrThrow<Session[]>(res)
}

export async function getSession(projectId: string, sessionId: string): Promise<Session> {
  const res = await fetch(
    `${AGENT_RUNNER_URL}/api/projects/${projectId}/sessions/${sessionId}`,
    { cache: 'no-store' },
  )
  return jsonOrThrow<Session>(res)
}

export async function createSession(
  projectId: string,
  input: CreateSessionInput,
): Promise<Session> {
  const res = await fetch(`${AGENT_RUNNER_URL}/api/projects/${projectId}/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  })
  return jsonOrThrow<Session>(res)
}

export async function deleteSession(projectId: string, sessionId: string): Promise<void> {
  const res = await fetch(
    `${AGENT_RUNNER_URL}/api/projects/${projectId}/sessions/${sessionId}`,
    { method: 'DELETE' },
  )
  if (!res.ok && res.status !== 204) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `agent-runner ${res.status}`)
  }
}

export async function sendChat(
  projectId: string,
  sessionId: string,
  text: string,
): Promise<void> {
  const res = await fetch(
    `${AGENT_RUNNER_URL}/api/projects/${projectId}/sessions/${sessionId}/chat`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    },
  )
  if (!res.ok && res.status !== 202) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `agent-runner ${res.status}`)
  }
}

export function ttydUrl(sessionId: string): string {
  return `${AGENT_RUNNER_URL}/ttyd/${sessionId}/`
}

/**
 * Build a Pascal session create-payload: per-project strategy (so
 * ~/.claude etc. persist across sessions), PASCAL_SCENE_ID set so the
 * agent's PASCAL.md hint file points at the right scene, plus the
 * SQLite bind mount.
 */
export function buildPascalSessionInput(args: {
  title: string
  agent: AgentKind
  sceneId: string
  initialPrompt?: string
}): CreateSessionInput {
  const containerEnv: Record<string, string> = {
    PASCAL_SCENE_ID: args.sceneId,
    PASCAL_DATA_DIR: '/pascal-data',
  }
  const extraMounts =
    PASCAL_DATA_DIR_HOST.length > 0
      ? [{ hostPath: PASCAL_DATA_DIR_HOST, containerPath: '/pascal-data' }]
      : undefined
  return {
    title: args.title,
    agent: args.agent,
    containerStrategy: 'per-project',
    initialPrompt: args.initialPrompt,
    containerEnv,
    extraMounts,
  }
}
