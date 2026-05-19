'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle, Loader2, Terminal } from 'lucide-react'
import { getSession, ttydUrl, type Session } from '@/lib/agent-runner-client'

interface Props {
  projectId: string
  sessionId: string | null
}

export function TerminalFrame({ projectId, sessionId }: Props) {
  const [session, setSession] = useState<Session | null>(null)
  const [error, setError] = useState<string | null>(null)
  // Distinguishes "session was deleted server-side" from "sidecar is down".
  const [gone, setGone] = useState(false)

  useEffect(() => {
    if (!sessionId) {
      setSession(null)
      setError(null)
      setGone(false)
      return
    }

    let cancelled = false
    const poll = async () => {
      try {
        const next = await getSession(projectId, sessionId)
        if (!cancelled) {
          setSession(next)
          setError(null)
          setGone(false)
        }
      } catch (err) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : String(err)
        if (/\b404\b/.test(msg) || /not[_ ]?found/i.test(msg)) {
          setGone(true)
          setError(null)
        } else {
          setError(msg)
        }
      }
    }
    void poll()

    // Tight poll while creating, then settle to a slower cadence.
    const id = window.setInterval(
      poll,
      session?.status === 'creating' ? 800 : 2500,
    )
    return () => {
      cancelled = true
      window.clearInterval(id)
    }
  }, [projectId, sessionId, session?.status])

  if (!sessionId) {
    return (
      <Placeholder>
        <Terminal className="h-5 w-5" />
        <p>No session selected. Create or pick one on the left.</p>
      </Placeholder>
    )
  }

  if (gone) {
    return (
      <Placeholder>
        <AlertTriangle className="h-5 w-5 text-amber-500" />
        <p>This session no longer exists. Pick another or create a new one.</p>
      </Placeholder>
    )
  }

  if (error) {
    return (
      <Placeholder>
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <p className="text-destructive">{error}</p>
      </Placeholder>
    )
  }

  if (!session || session.status === 'creating') {
    return (
      <Placeholder>
        <Loader2 className="h-5 w-5 animate-spin" />
        <p>Starting container…</p>
        <p className="text-[10px] opacity-70">
          First boot of a fresh agent can take ~20s.
        </p>
      </Placeholder>
    )
  }

  if (session.status === 'error') {
    return (
      <Placeholder>
        <AlertTriangle className="h-5 w-5 text-destructive" />
        <p className="text-destructive">{session.lastError ?? 'Session errored.'}</p>
        <p className="text-[10px] opacity-70">
          Delete this session and create a new one to retry.
        </p>
      </Placeholder>
    )
  }

  if (session.status === 'stopped') {
    return (
      <Placeholder>
        <Terminal className="h-5 w-5" />
        <p>Container is stopped.</p>
        <p className="text-[10px] opacity-70">
          The sidecar will restart it on the next poll; if it doesn't, delete
          and recreate the session.
        </p>
      </Placeholder>
    )
  }

  if (session.status !== 'running') {
    return (
      <Placeholder>
        <Terminal className="h-5 w-5" />
        <p>Session is {session.status}.</p>
      </Placeholder>
    )
  }

  return (
    <iframe
      // The iframe loads ttyd directly from the sidecar origin so the
      // WebSocket upgrade works in dev (Next.js rewrites don't proxy WS).
      src={ttydUrl(session.id)}
      title={`Terminal — ${session.title}`}
      className="h-full w-full border-0 bg-black"
      // sandbox attribute deliberately omitted — ttyd needs same-origin
      // access to its own assets/WS within the iframe.
    />
  )
}

function Placeholder({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-muted/30">
      <div className="flex flex-col items-center gap-2 text-muted-foreground text-xs">
        {children}
      </div>
    </div>
  )
}
