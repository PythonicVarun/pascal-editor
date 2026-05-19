'use client'

import {
  applySceneGraphToEditor,
  Editor,
  type SceneGraph,
  type SidebarTab,
} from '@pascal-app/editor'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ArrowLeft, GripVertical, Layers } from 'lucide-react'
import { Group, Panel, Separator } from 'react-resizable-panels'
import {
  CommunityViewerToolbarLeft,
  CommunityViewerToolbarRight,
} from '@/components/viewer-toolbar'
import type { SceneMeta } from '@/components/scene-loader'
import { ensurePascalProject, type Project } from '@/lib/agent-runner-client'
import { SessionsPanel } from './sessions-panel'
import { ChatPanel } from './chat-panel'
import { TerminalFrame } from './terminal-frame'

const SIDEBAR_TABS: (SidebarTab & { component: React.ComponentType })[] = [
  { id: 'site', label: 'Scene', component: () => null },
]

type SceneGraphWithCollections = SceneGraph & {
  collections?: Record<string, unknown>
}

interface LiveSceneEvent {
  eventId: number
  sceneId: string
  version: number
  kind: string
  createdAt: string
  graph: SceneGraphWithCollections
}

function sceneGraphSignature(graph: SceneGraphWithCollections): string {
  return JSON.stringify({
    nodes: graph.nodes,
    rootNodeIds: graph.rootNodeIds,
    collections: graph.collections,
  })
}

interface Props {
  initialScene: SceneGraph
  meta: SceneMeta
}

export function AgentWorkspace({ initialScene, meta }: Props) {
  const router = useRouter()
  const versionRef = useRef(meta.version)
  const lastRemoteGraphJsonRef = useRef<string | null>(null)
  const suppressRemoteSaveUntilRef = useRef(0)
  const [conflict, setConflict] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [project, setProject] = useState<Project | null>(null)
  const [projectError, setProjectError] = useState<string | null>(null)
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null)

  const handleLoad = useCallback(async () => initialScene, [initialScene])

  const handleSave = useCallback(
    async (graph: SceneGraph) => {
      const graphJson = sceneGraphSignature(graph)
      const isRecentRemoteApply = Date.now() < suppressRemoteSaveUntilRef.current
      if (lastRemoteGraphJsonRef.current === graphJson) {
        lastRemoteGraphJsonRef.current = null
        suppressRemoteSaveUntilRef.current = 0
        return
      }
      if (isRecentRemoteApply) return
      try {
        const response = await fetch(`/api/scenes/${meta.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'If-Match': String(versionRef.current),
          },
          body: JSON.stringify({ name: meta.name, graph }),
        })
        if (response.status === 409) {
          setConflict(true)
          return
        }
        if (!response.ok) {
          setSaveError(`Save failed (${response.status})`)
          return
        }
        const next = (await response.json()) as SceneMeta
        versionRef.current = next.version
        setSaveError(null)
      } catch (error) {
        setSaveError(error instanceof Error ? error.message : 'Save failed')
      }
    },
    [meta.id, meta.name],
  )

  // SSE subscription so MCP mutations from inside the agent container
  // flow into the local useScene store and re-render the 3D viewer.
  useEffect(() => {
    const source = new EventSource(`/api/scenes/${meta.id}/events`)
    source.addEventListener('scene', (event) => {
      let payload: LiveSceneEvent
      try {
        payload = JSON.parse((event as MessageEvent<string>).data) as LiveSceneEvent
      } catch {
        return
      }
      if (payload.sceneId !== meta.id) return
      if (payload.version <= versionRef.current) return
      versionRef.current = payload.version
      lastRemoteGraphJsonRef.current = sceneGraphSignature(payload.graph)
      suppressRemoteSaveUntilRef.current = Date.now() + 2500
      applySceneGraphToEditor(payload.graph)
      setConflict(false)
      setSaveError(null)
    })
    source.addEventListener('error', () => {
      if (source.readyState === EventSource.CLOSED) {
        setSaveError('Live scene connection closed')
      }
    })
    return () => source.close()
  }, [meta.id])

  // Get-or-create the shared "pascal" project in the agent runner.
  useEffect(() => {
    let cancelled = false
    ensurePascalProject()
      .then((p) => {
        if (!cancelled) setProject(p)
      })
      .catch((err: Error) => {
        if (!cancelled)
          setProjectError(
            `Agent runner unavailable: ${err.message}. Start it with \`bun run dev:agent-runner\`.`,
          )
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      {/* Conflict + save error toasts (mirrors scene-loader behavior) */}
      {conflict ? (
        <div className="pointer-events-auto absolute top-4 left-1/2 z-[100] w-full max-w-md -translate-x-1/2 rounded-lg border border-border bg-background p-4 shadow-xl">
          <h2 className="font-semibold text-sm">Another session saved first — refresh?</h2>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              className="rounded-md border border-border bg-accent px-3 py-1.5 font-medium text-xs hover:bg-accent/80"
              onClick={() => router.refresh()}
            >
              Reload
            </button>
            <button
              type="button"
              className="rounded-md border border-border bg-background px-3 py-1.5 font-medium text-xs hover:bg-accent/40"
              onClick={() => setConflict(false)}
            >
              Dismiss
            </button>
          </div>
        </div>
      ) : null}
      {saveError && !conflict ? (
        <div className="pointer-events-auto absolute top-4 left-1/2 z-[100] w-full max-w-md -translate-x-1/2 rounded-lg border border-destructive/50 bg-background p-3 shadow-xl">
          <p className="font-medium text-destructive text-xs">{saveError}</p>
        </div>
      ) : null}

      <Group orientation="horizontal" className="h-full w-full">
        {/* LEFT: Sessions list + chat input */}
        <Panel defaultSize={22} minSize={16}>
          <div className="flex h-full flex-col border-border border-r bg-background">
            <div className="flex items-center gap-2 border-border border-b p-3">
              <Link
                href="/agent"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Back to scene picker"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="min-w-0 flex-1">
                <h1 className="truncate font-semibold text-foreground text-sm">{meta.name}</h1>
                <p className="text-muted-foreground text-[10px]">Agent workspace</p>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              {projectError ? (
                <div className="m-3 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-destructive text-xs">
                  {projectError}
                </div>
              ) : !project ? (
                <p className="px-4 py-6 text-center text-muted-foreground text-xs">
                  Connecting to agent runner…
                </p>
              ) : (
                <SessionsPanel
                  projectId={project.id}
                  sceneId={meta.id}
                  selectedId={selectedSessionId}
                  onSelect={(sid) => setSelectedSessionId(sid || null)}
                />
              )}
            </div>

            {project ? (
              <ChatPanel projectId={project.id} sessionId={selectedSessionId} />
            ) : null}
          </div>
        </Panel>

        <PanelSeparator />

        {/* MIDDLE: Embedded terminal */}
        <Panel defaultSize={38} minSize={24}>
          <div className="h-full w-full bg-background">
            <TerminalFrame projectId={project?.id ?? ''} sessionId={selectedSessionId} />
          </div>
        </Panel>

        <PanelSeparator />

        {/* RIGHT: 3D viewer, scene-bound + SSE-synced */}
        <Panel defaultSize={40} minSize={25} className="relative h-full">
          <Editor
            layoutVersion="v2"
            onLoad={handleLoad}
            onSave={handleSave}
            projectId={meta.projectId ?? 'default'}
            sidebarTabs={SIDEBAR_TABS}
            viewerToolbarLeft={<CommunityViewerToolbarLeft />}
            viewerToolbarRight={<CommunityViewerToolbarRight />}
          />
        </Panel>
      </Group>
    </div>
  )
}

function PanelSeparator() {
  return (
    <Separator className="group z-50 flex w-2 cursor-col-resize items-center justify-center bg-border/50 transition-colors hover:bg-border/80">
      <div className="flex h-8 w-1 items-center justify-center rounded-full bg-border transition-colors group-hover:bg-primary/50">
        <GripVertical className="h-3 w-3 scale-0 text-muted-foreground transition-transform group-hover:scale-100" />
      </div>
    </Separator>
  )
}
