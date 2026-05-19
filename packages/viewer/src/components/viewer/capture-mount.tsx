'use client'

import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import * as THREE from 'three/webgpu'
import { setCapturer, type ViewPreset } from '../../lib/capture-bridge'

// PNG mime for clarity; the agent's MCP tool advertises image/png.
const CAPTURE_MIME = 'image/png'

// Fallback bounds when the scene has nothing in it — keeps preset cameras
// from collapsing to a zero-extent box.
const FALLBACK_BOUNDS = new THREE.Box3(
  new THREE.Vector3(-10, 0, -10),
  new THREE.Vector3(10, 10, 10),
)

function buildSceneBounds(root: THREE.Object3D): THREE.Box3 {
  const box = new THREE.Box3()
  let hasGeometry = false
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh
    if (!mesh.isMesh || !mesh.geometry) return
    // Skip helpers / non-visible scaffolding to avoid framing on debug gizmos.
    if (!mesh.visible) return
    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox()
    const local = mesh.geometry.boundingBox
    if (!local) return
    const world = local.clone().applyMatrix4(mesh.matrixWorld)
    if (hasGeometry) {
      box.union(world)
    } else {
      box.copy(world)
      hasGeometry = true
    }
  })
  if (!hasGeometry) return FALLBACK_BOUNDS.clone()
  return box
}

type PresetPose = {
  position: THREE.Vector3
  up: THREE.Vector3
  ortho: boolean
}

function presetPose(view: Exclude<ViewPreset, 'current'>, bounds: THREE.Box3): PresetPose {
  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const radius = Math.max(size.x, size.y, size.z) * 0.75 + 5
  switch (view) {
    case 'top':
      return {
        position: new THREE.Vector3(center.x, bounds.max.y + radius * 2, center.z),
        up: new THREE.Vector3(0, 0, -1),
        ortho: true,
      }
    case 'front':
      return {
        position: new THREE.Vector3(center.x, center.y, bounds.max.z + radius * 2),
        up: new THREE.Vector3(0, 1, 0),
        ortho: true,
      }
    case 'iso':
      return {
        position: new THREE.Vector3(
          center.x + radius * 1.5,
          center.y + radius * 1.5,
          center.z + radius * 1.5,
        ),
        up: new THREE.Vector3(0, 1, 0),
        ortho: true,
      }
    case 'perspective':
      return {
        position: new THREE.Vector3(
          center.x + radius * 2,
          center.y + radius * 1.2,
          center.z + radius * 2,
        ),
        up: new THREE.Vector3(0, 1, 0),
        ortho: false,
      }
  }
}

function buildPresetCamera(
  view: Exclude<ViewPreset, 'current'>,
  bounds: THREE.Box3,
  aspect: number,
): THREE.Camera {
  const pose = presetPose(view, bounds)
  const center = bounds.getCenter(new THREE.Vector3())
  const size = bounds.getSize(new THREE.Vector3())
  const span = Math.max(size.x, size.y, size.z) * 1.2 + 4
  const distance = pose.position.distanceTo(center) || span * 2
  const near = Math.max(0.1, distance - span * 2)
  const far = distance + span * 4

  if (pose.ortho) {
    const halfH = span * 0.6
    const halfW = halfH * aspect
    const cam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, near, far)
    cam.position.copy(pose.position)
    cam.up.copy(pose.up)
    cam.lookAt(center)
    cam.updateMatrixWorld(true)
    cam.updateProjectionMatrix()
    return cam
  }

  const cam = new THREE.PerspectiveCamera(50, aspect, Math.max(0.1, near), far)
  cam.position.copy(pose.position)
  cam.up.copy(pose.up)
  cam.lookAt(center)
  cam.updateMatrixWorld(true)
  cam.updateProjectionMatrix()
  return cam
}

export function CaptureMount() {
  const gl = useThree((s) => s.gl)
  const scene = useThree((s) => s.scene)
  const camera = useThree((s) => s.camera)
  const size = useThree((s) => s.size)

  useEffect(() => {
    const capture = async (view: ViewPreset): Promise<Blob> => {
      const canvas = (gl as any).domElement as HTMLCanvasElement | undefined
      if (!canvas) throw new Error('viewer_canvas_missing')

      const targetCamera =
        view === 'current'
          ? camera
          : buildPresetCamera(
              view,
              buildSceneBounds(scene),
              size.width / Math.max(1, size.height),
            )

      // WebGPU compositor clears the canvas after swap, so we must render and
      // toBlob inside the same RAF without awaiting anything heavy between
      // them. Re-render with the user's camera immediately after capture so
      // the visible canvas snaps back before the next compositor swap.
      return new Promise<Blob>((resolve, reject) => {
        requestAnimationFrame(() => {
          try {
            ;(gl as any).render(scene, targetCamera)
          } catch (err) {
            reject(err instanceof Error ? err : new Error(String(err)))
            return
          }
          canvas.toBlob((blob) => {
            // Restore the user's camera draw so the visible canvas doesn't
            // show the preset frame on the next swap. Safe to do after toBlob
            // hands back the pixels.
            if (view !== 'current') {
              try {
                ;(gl as any).render(scene, camera)
              } catch {
                // The next post-processing frame will recover; nothing to do.
              }
            }
            if (!blob) {
              reject(new Error('canvas_toblob_failed'))
              return
            }
            resolve(blob)
          }, CAPTURE_MIME)
        })
      })
    }

    setCapturer(capture)
    return () => setCapturer(null)
  }, [gl, scene, camera, size.width, size.height])

  return null
}

export default CaptureMount
