'use client'

import { useState } from 'react'
import type { SceneMeta } from '@/components/scene-loader'
import { SceneCard } from '@/components/scene-card'

interface AgentScenesListProps {
  scenes: SceneMeta[]
}

export function AgentScenesList({ scenes: initialScenes }: AgentScenesListProps) {
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
    <ul className="space-y-2">
      {scenes.map((s) => (
        <SceneCard
          key={s.id}
          scene={s}
          isAgentMode
          onDelete={handleDelete}
        />
      ))}
    </ul>
  )
}
