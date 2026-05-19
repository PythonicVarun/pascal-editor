'use client'

import type { SceneGraph } from '@pascal-app/editor'
import { useRouter } from 'next/navigation'
import { useCallback, useState } from 'react'
import { Bot, Loader2 } from 'lucide-react'

const EMPTY_GRAPH: SceneGraph = {
  nodes: {},
  rootNodeIds: [],
}

/**
 * Creates a new empty scene and routes to its agent workspace.
 */
export function CreateAgentSceneButton() {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const create = useCallback(async () => {
    setBusy(true)
    setError(null)
    try {
      const response = await fetch('/api/scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Agent workspace', graph: EMPTY_GRAPH }),
      })
      if (!response.ok) {
        setError(`Failed to create scene (${response.status})`)
        return
      }
      const meta = (await response.json()) as { id: string }
      router.push(`/agent/${meta.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create scene')
    } finally {
      setBusy(false)
    }
  }, [router])

  return (
    <div className="flex items-center gap-3">
      {error ? <span className="text-destructive text-xs">{error}</span> : null}
      <button
        type="button"
        disabled={busy}
        onClick={create}
        className="flex items-center gap-2 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground text-sm hover:bg-primary/90 disabled:opacity-50"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bot className="h-4 w-4" />}
        {busy ? 'Creating…' : 'Start new agent workspace'}
      </button>
    </div>
  )
}
