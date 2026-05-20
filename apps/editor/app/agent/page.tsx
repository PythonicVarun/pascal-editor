import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowRight, Bot } from 'lucide-react'
import { CreateAgentSceneButton } from '@/components/agent/create-agent-scene-button'
import { AgentScenesList } from '@/components/agent/agent-scenes-list'
import type { SceneMeta } from '@/components/scene-loader'

export const dynamic = 'force-dynamic'

async function resolveBaseUrl(): Promise<string> {
  if (process.env.NEXT_PUBLIC_APP_URL) return process.env.NEXT_PUBLIC_APP_URL
  const h = await headers()
  const host = h.get('x-forwarded-host') ?? h.get('host')
  const proto = h.get('x-forwarded-proto') ?? 'http'
  if (!host) return 'http://localhost:3000'
  return `${proto}://${host}`
}

async function fetchScenes(): Promise<SceneMeta[]> {
  const base = await resolveBaseUrl()
  const response = await fetch(`${base}/api/scenes?limit=50`, { cache: 'no-store' })
  if (!response.ok) return []
  const payload = (await response.json()) as { scenes?: SceneMeta[] } | SceneMeta[]
  if (Array.isArray(payload)) return payload
  return payload.scenes ?? []
}

export default async function AgentEntryPage() {
  const scenes = await fetchScenes()

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 border-border border-b bg-background/95 backdrop-blur">
        <div className="container mx-auto flex items-center justify-between gap-4 px-6 py-4">
          <nav className="flex items-center gap-4 text-sm">
            <Link
              className="text-muted-foreground transition-colors hover:text-foreground"
              href="/"
            >
              Home
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium text-foreground">Agent mode</span>
          </nav>
          <CreateAgentSceneButton />
        </div>
      </header>

      <main className="container mx-auto max-w-3xl px-6 py-12">
        <div className="mb-10">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-border bg-muted/40 px-3 py-1 font-medium text-muted-foreground text-xs">
            <Bot className="h-3 w-3" /> Experimental
          </div>
          <h1 className="mb-2 font-bold text-3xl">Agent mode</h1>
          <p className="text-muted-foreground text-sm">
            Spin up Claude Code, Codex, Gemini CLI, or Copilot CLI inside a sandboxed container —
            give it Pascal MCP tools, then watch it edit the scene live in the 3D viewer.
          </p>
        </div>

        <h2 className="mb-3 font-semibold text-foreground text-sm">Open a scene in agent mode</h2>
        {scenes.length === 0 ? (
          <div className="rounded-xl border border-border/60 border-dashed bg-background p-10 text-center">
            <p className="text-muted-foreground text-sm">No saved scenes yet.</p>
            <p className="mt-1 text-muted-foreground text-xs">
              Create a new scene to attach an agent to.
            </p>
            <div className="mt-4 flex justify-center">
              <CreateAgentSceneButton />
            </div>
          </div>
        ) : (
          <AgentScenesList scenes={scenes} />
        )}
      </main>
    </div>
  )
}
