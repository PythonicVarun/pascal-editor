'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ChevronRight, File, Folder, Loader2, RefreshCw } from 'lucide-react'
import { readTree, type FsNode } from '@/lib/agent-runner-fs'
import { subscribeFsEvents } from '@/lib/agent-runner-socket'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  selectedPath: string | null
  onSelect: (path: string) => void
}

export function FileTree({ projectId, selectedPath, onSelect }: Props) {
  const [tree, setTree] = useState<FsNode | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const reloadTimer = useRef<number | undefined>(undefined)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      setTree(await readTree(projectId))
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [projectId])

  // Debounce reloads — agents writing a burst of files would otherwise
  // hammer /fs/tree.
  const scheduleReload = useCallback(() => {
    if (reloadTimer.current) window.clearTimeout(reloadTimer.current)
    reloadTimer.current = window.setTimeout(() => {
      void reload()
    }, 250)
  }, [reload])

  useEffect(() => {
    void reload()
    const unsub = subscribeFsEvents(projectId, () => scheduleReload())
    return () => {
      unsub()
      if (reloadTimer.current) window.clearTimeout(reloadTimer.current)
    }
  }, [projectId, reload, scheduleReload])

  return (
    <div className="flex h-full flex-col border-border border-r bg-background">
      <div className="flex items-center justify-between border-border border-b px-3 py-2">
        <h3 className="font-semibold text-foreground text-xs">Workspace</h3>
        <button
          type="button"
          onClick={() => void reload()}
          className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label="Reload tree"
        >
          {loading ? (
            <Loader2 className="h-3 w-3 animate-spin" />
          ) : (
            <RefreshCw className="h-3 w-3" />
          )}
        </button>
      </div>
      <div className="flex-1 overflow-auto p-1 font-mono text-xs">
        {error ? (
          <div className="m-2 rounded-md border border-destructive/30 bg-destructive/10 px-2 py-1.5 text-destructive">
            {error}
          </div>
        ) : !tree ? (
          <p className="px-3 py-2 text-muted-foreground">Loading…</p>
        ) : tree.children && tree.children.length > 0 ? (
          <NodeView
            nodes={tree.children}
            depth={0}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ) : (
          <p className="px-3 py-2 text-muted-foreground">Empty workspace.</p>
        )}
      </div>
    </div>
  )
}

interface NodeViewProps {
  nodes: FsNode[]
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
}

function NodeView({ nodes, depth, selectedPath, onSelect }: NodeViewProps) {
  const sorted = useMemo(
    () =>
      nodes.slice().sort((a, b) => {
        if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
        return a.name.localeCompare(b.name)
      }),
    [nodes],
  )
  return (
    <ul className="space-y-px">
      {sorted.map((node) =>
        node.type === 'directory' ? (
          <DirectoryRow
            key={node.path}
            node={node}
            depth={depth}
            selectedPath={selectedPath}
            onSelect={onSelect}
          />
        ) : (
          <FileRow
            key={node.path}
            node={node}
            depth={depth}
            selected={selectedPath === node.path}
            onSelect={onSelect}
          />
        ),
      )}
    </ul>
  )
}

function DirectoryRow({
  node,
  depth,
  selectedPath,
  onSelect,
}: {
  node: FsNode
  depth: number
  selectedPath: string | null
  onSelect: (path: string) => void
}) {
  // Open directories that contain the currently-selected file by default.
  const [open, setOpen] = useState(
    () => selectedPath !== null && selectedPath.startsWith(`${node.path}/`),
  )
  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center gap-1 rounded-md px-1 py-0.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
        style={{ paddingLeft: `${depth * 10 + 4}px` }}
      >
        <ChevronRight
          className={cn(
            'h-3 w-3 flex-shrink-0 transition-transform',
            open ? 'rotate-90' : 'rotate-0',
          )}
        />
        <Folder className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
      {open && node.children && node.children.length > 0 ? (
        <NodeView
          nodes={node.children}
          depth={depth + 1}
          selectedPath={selectedPath}
          onSelect={onSelect}
        />
      ) : null}
    </li>
  )
}

function FileRow({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: FsNode
  depth: number
  selected: boolean
  onSelect: (path: string) => void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(node.path)}
        className={cn(
          'flex w-full items-center gap-1 rounded-md px-1 py-0.5',
          selected
            ? 'bg-primary/10 text-foreground'
            : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        )}
        style={{ paddingLeft: `${depth * 10 + 17}px` }}
      >
        <File className="h-3 w-3 flex-shrink-0" />
        <span className="truncate">{node.name}</span>
      </button>
    </li>
  )
}
