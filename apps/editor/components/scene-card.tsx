'use client'

import { useState } from 'react'
import Link from 'next/link'
import { MoreHorizontal, Trash2 } from 'lucide-react'
import type { SceneMeta } from './scene-loader'

interface SceneCardProps {
  scene: SceneMeta
  isAgentMode?: boolean
  onDelete?: (sceneId: string) => Promise<void>
}

export function SceneCard({ scene, isAgentMode = false, onDelete }: SceneCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!onDelete) return
    
    setIsDeleting(true)
    setError(null)
    try {
      await onDelete(scene.id)
      setDeleteConfirm(false)
      setMenuOpen(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete scene')
      setIsDeleting(false)
    }
  }

  const sceneLink = isAgentMode ? `/agent/${scene.id}` : `/scene/${scene.id}`

  if (deleteConfirm) {
    return (
      <div className="rounded-xl border border-border/60 bg-background p-4">
        <div className="mb-4">
          <p className="font-medium text-sm">{scene.name}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Are you sure you want to delete this scene? This action cannot be undone.
          </p>
        </div>
        {error && (
          <div className="mb-3 rounded-md bg-destructive/10 p-2 text-xs text-destructive">
            {error}
          </div>
        )}
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => setDeleteConfirm(false)}
            disabled={isDeleting}
            className="px-3 py-1.5 text-xs rounded-md border border-border bg-background hover:bg-accent/30 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => void handleDelete()}
            disabled={isDeleting}
            className="px-3 py-1.5 text-xs rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50"
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    )
  }

  if (isAgentMode) {
    return (
      <div className="group relative rounded-md border border-border/60 bg-background px-4 py-3 transition-colors hover:border-border hover:bg-accent/30">
        <div className="flex items-center justify-between gap-3">
          <Link
            href={sceneLink}
            className="min-w-0 flex-1"
          >
            <div>
              <p className="truncate font-medium text-foreground text-sm">{scene.name}</p>
              <p className="mt-0.5 text-muted-foreground text-xs">
                {scene.nodeCount} nodes · updated {formatDate(scene.updatedAt)}
              </p>
            </div>
          </Link>
          {onDelete && (
            <div className="relative">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="rounded p-1 text-muted-foreground hover:bg-accent/40 hover:text-foreground"
              >
                <MoreHorizontal className="h-4 w-4" />
              </button>
              {menuOpen && (
                <div
                  className="absolute right-0 z-10 mt-1 w-40 rounded-md border border-border bg-background p-1 shadow-lg"
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    onClick={() => {
                      setMenuOpen(false)
                      setDeleteConfirm(true)
                    }}
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <li className="group relative">
      <Link
        className="block rounded-xl border border-border/60 bg-background p-4 transition-colors hover:border-border hover:bg-accent/30"
        href={sceneLink}
      >
        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-accent/30">
          {scene.thumbnailUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={scene.name}
              className="h-full w-full object-cover"
              src={scene.thumbnailUrl}
            />
          ) : (
            <span className="text-muted-foreground text-xs">No thumbnail</span>
          )}
        </div>
        <div className="mt-3">
          <h2 className="truncate font-semibold text-sm group-hover:text-foreground">
            {scene.name}
          </h2>
          <div className="mt-1 flex items-center justify-between text-muted-foreground text-xs">
            <span>{scene.nodeCount} nodes</span>
            <time dateTime={scene.updatedAt}>{formatDate(scene.updatedAt)}</time>
          </div>
        </div>
      </Link>
      {onDelete && (
        <div className="absolute top-2 right-2 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="rounded-md bg-background/90 p-2 hover:bg-background border border-border/60"
            title="Scene options"
          >
            <MoreHorizontal className="h-4 w-4 text-foreground" />
          </button>
          {menuOpen && (
            <div
              className="absolute right-0 top-full z-10 mt-1 w-44 rounded-md border border-border bg-background p-1 shadow-lg"
              onMouseLeave={() => setMenuOpen(false)}
            >
              <button
                onClick={() => {
                  setMenuOpen(false)
                  setDeleteConfirm(true)
                }}
                className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete scene
              </button>
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString()
  } catch {
    return iso
  }
}
