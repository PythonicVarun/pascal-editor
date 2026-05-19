'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Bot, Plus, Trash2, Loader2, RefreshCw, WifiOff } from 'lucide-react'
import {
  AGENT_KINDS,
  type AgentKind,
  buildPascalSessionInput,
  createSession,
  deleteSession,
  listSessions,
  type Session,
} from '@/lib/agent-runner-client'
import { cn } from '@/lib/utils'

const AGENT_LABELS: Record<AgentKind, string> = {
  claude: 'Claude Code',
  codex: 'Codex',
  gemini: 'Gemini CLI',
  copilot: 'Copilot CLI',
  shell: 'Plain shell',
}

interface Props {
  projectId: string
  sceneId: string
  selectedId: string | null
  onSelect: (sessionId: string | null) => void
}

export function SessionsPanel({ projectId, sceneId, selectedId, onSelect }: Props) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newAgent, setNewAgent] = useState<AgentKind>('claude')
  const [reachable, setReachable] = useState(true)
  const [loadedOnce, setLoadedOnce] = useState(false)
  // Keep the latest selection visible to the reconciliation effect without
  // restarting the polling loop every time the selection changes.
  const selectedRef = useRef(selectedId)
  selectedRef.current = selectedId

  const refresh = useCallback(async () => {
    try {
      const next = await listSessions(projectId)
      setSessions(next)
      setError(null)
      setReachable(true)
      setLoadedOnce(true)

      // Drop stale selection if the session no longer exists server-side.
      const current = selectedRef.current
      if (current && !next.some((s) => s.id === current)) {
        onSelect(null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
      setReachable(false)
    }
  }, [projectId, onSelect])

  useEffect(() => {
    void refresh()
    const id = window.setInterval(refresh, 4000)
    return () => window.clearInterval(id)
  }, [refresh])

  // Auto-select the most recent session once on first load when nothing is
  // already selected (e.g. fresh browser, no localStorage entry).
  const autoSelectedRef = useRef(false)
  useEffect(() => {
    if (autoSelectedRef.current) return
    if (!loadedOnce) return
    if (selectedRef.current) {
      autoSelectedRef.current = true
      return
    }
    if (sessions.length === 0) return
    const newest = sessions
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
    if (newest) {
      autoSelectedRef.current = true
      onSelect(newest.id)
    }
  }, [loadedOnce, sessions, onSelect])

  const handleCreate = async () => {
    setCreating(true)
    try {
      const payload = buildPascalSessionInput({
        title: `${AGENT_LABELS[newAgent]} — ${new Date().toLocaleTimeString()}`,
        agent: newAgent,
        sceneId,
      })
      const next = await createSession(projectId, payload)
      onSelect(next.id)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setCreating(false)
    }
  }

  const handleDelete = async (sid: string) => {
    try {
      await deleteSession(projectId, sid)
      if (selectedId === sid) onSelect(null)
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const sorted = useMemo(
    () => sessions.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [sessions],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="border-border border-b p-3">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold text-foreground text-sm">Agent sessions</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <select
            value={newAgent}
            onChange={(e) => setNewAgent(e.target.value as AgentKind)}
            className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-xs outline-none focus:border-primary"
          >
            {AGENT_KINDS.map((k) => (
              <option key={k} value={k}>
                {AGENT_LABELS[k]}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={creating}
            onClick={handleCreate}
            className="flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 font-medium text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50"
          >
            {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            New
          </button>
        </div>
      </div>

      {error ? (
        <div
          className={cn(
            'm-3 flex items-start gap-2 rounded-md border px-3 py-2 text-xs',
            reachable
              ? 'border-destructive/30 bg-destructive/10 text-destructive'
              : 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
          )}
        >
          {reachable ? null : <WifiOff className="mt-0.5 h-3 w-3 flex-shrink-0" />}
          <div className="flex-1">
            <p className="font-medium">
              {reachable ? 'Agent runner error' : "Can't reach the agent runner"}
            </p>
            <p className="mt-0.5 opacity-80">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => void refresh()}
            className="flex flex-shrink-0 items-center gap-1 rounded-md border border-current/30 px-1.5 py-0.5 font-medium hover:bg-current/10"
            aria-label="Retry"
          >
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      ) : null}

      <div className="flex-1 overflow-y-auto p-2">
        {sorted.length === 0 ? (
          <p className="px-2 py-4 text-center text-muted-foreground text-xs">
            No sessions yet. Create one to start.
          </p>
        ) : (
          <ul className="space-y-1">
            {sorted.map((s) => (
              <li key={s.id}>
                <div
                  className={cn(
                    'group flex items-center gap-2 rounded-md px-2 py-1.5 text-xs',
                    selectedId === s.id
                      ? 'bg-primary/10 text-foreground'
                      : 'text-muted-foreground hover:bg-muted/60',
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelect(s.id)}
                    className="flex flex-1 items-center gap-2 truncate text-left"
                  >
                    <Bot className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate font-medium">{s.title}</span>
                    <StatusDot status={s.status} />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(s.id)}
                    className="hidden rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-destructive group-hover:block"
                    aria-label="Delete session"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: Session['status'] }) {
  const color =
    status === 'running'
      ? 'bg-emerald-500'
      : status === 'creating'
        ? 'bg-amber-500 animate-pulse'
        : status === 'error'
          ? 'bg-destructive'
          : 'bg-muted-foreground/50'
  return <span className={cn('ml-auto h-1.5 w-1.5 flex-shrink-0 rounded-full', color)} />
}
