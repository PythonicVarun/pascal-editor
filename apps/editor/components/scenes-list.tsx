'use client'

import { useState } from 'react'
import type { SceneMeta } from '@/components/scene-loader'
import { SceneCard } from '@/components/scene-card'

interface ScenesListProps {
  scenes: SceneMeta[]
}

export function ScenesList({ scenes: initialScenes }: ScenesListProps) {
  const [scenes, setScenes] = useState(initialScenes)

  const handleDelete = async (sceneId: string) => {
    const response = await fetch(`/api/scenes/${sceneId}`, {
      method: 'DELETE',
    })

    if (!response.ok) {
      const error = await response.json().catch(() => ({}))
      throw new Error(
        error.error || `Failed to delete scene (${response.status})`,
      )
    }

    // Remove from list
    setScenes((prev) => prev.filter((s) => s.id !== sceneId))
  }

  return (
    <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {scenes.map((scene) => (
        <SceneCard
          key={scene.id}
          scene={scene}
          onDelete={handleDelete}
        />
      ))}
    </ul>
  )
}
