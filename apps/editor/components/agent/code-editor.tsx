'use client'

import EditorMonaco from '@monaco-editor/react'
import { useScene } from '@pascal-app/core'
import {
  AlertTriangle,
  FileCode,
  Loader2,
  Play,
  Save,
  RefreshCw,
} from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { monacoLanguageFor, readFile, writeFile } from '@/lib/agent-runner-fs'
import { subscribeFsEvents } from '@/lib/agent-runner-socket'
import { cn } from '@/lib/utils'

interface Props {
  projectId: string
  path: string | null
}

export function CodeEditor({ projectId, path }: Props) {
  const [content, setContent] = useState('')
  const [original, setOriginal] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [truncated, setTruncated] = useState(false)
  // Tracks whether an agent-written change is waiting for the user to accept.
  const [remoteUpdate, setRemoteUpdate] = useState(false)
  const dirty = content !== original

  const load = useCallback(async () => {
    if (!path) {
      setContent('')
      setOriginal('')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const file = await readFile(projectId, path)
      setContent(file.content)
      setOriginal(file.content)
      setTruncated(file.truncated)
      setRemoteUpdate(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [projectId, path])

  useEffect(() => {
    void load()
  }, [load])

  // If the agent rewrites the currently-open file, surface a banner
  // instead of clobbering local edits.
  const dirtyRef = useRef(dirty)
  dirtyRef.current = dirty
  useEffect(() => {
    if (!path) return
    const unsub = subscribeFsEvents(projectId, (ev) => {
      if (ev.path !== path) return
      if (ev.type === 'unlink') {
        setError('File removed by the agent.')
        return
      }
      if (dirtyRef.current) {
        setRemoteUpdate(true)
      } else {
        void load()
      }
    })
    return unsub
  }, [projectId, path, load])

  const save = useCallback(async () => {
    if (!path || truncated) return
    setSaving(true)
    setStatus(null)
    setError(null)
    try {
      await writeFile(projectId, path, content)
      setOriginal(content)
      setStatus('Saved')
      window.setTimeout(() => setStatus((s) => (s === 'Saved' ? null : s)), 1500)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setSaving(false)
    }
  }, [content, truncated, path, projectId])

  // Ctrl/Cmd-S to save while focused on the editor.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        if (path && !truncated) {
          e.preventDefault()
          void save()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [truncated, path, save])

  const runInBrowser = useCallback(() => {
    if (!path) return
    setRunning(true)
    setStatus(null)
    setError(null)
    try {
      const sceneAPI = useScene.getState()
      // Same pattern as the original /agent in-browser sandbox: feed the
      // file's contents as a function body with sceneAPI in scope.
      // eslint-disable-next-line no-new-func
      const fn = new Function('sceneAPI', content)
      fn(sceneAPI)
      setStatus('Ran in browser')
      window.setTimeout(
        () => setStatus((s) => (s === 'Ran in browser' ? null : s)),
        2000,
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setRunning(false)
    }
  }, [content, path])

  if (!path) {
    return (
      <Placeholder>
        <FileCode className="h-5 w-5" />
        <p>Pick a file in the workspace tree to view it here.</p>
      </Placeholder>
    )
  }

  const language = monacoLanguageFor(path)
  const isJs = language === 'javascript'

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between gap-2 border-border border-b bg-background px-3 py-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-mono text-foreground text-xs">
            {path}
            {dirty ? <span className="ml-1 text-amber-500">●</span> : null}
          </p>
          {status ? (
            <p className="mt-0.5 text-muted-foreground text-[10px]">{status}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-1.5">
          {isJs ? (
            <button
              type="button"
              onClick={runInBrowser}
              disabled={running || loading || truncated}
              title="Execute file contents against the in-browser sceneAPI"
              className="flex items-center gap-1 rounded-md border border-border bg-background px-2 py-1 font-medium text-foreground text-xs hover:bg-muted disabled:opacity-50"
            >
              {running ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
              Run in browser
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading || !dirty || truncated}
            className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 font-medium text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
            Save
          </button>
        </div>
      </div>

      {error ? (
        <div className="flex items-start gap-2 border-destructive/30 border-b bg-destructive/10 px-3 py-1.5 text-destructive text-xs">
          <AlertTriangle className="mt-0.5 h-3 w-3 flex-shrink-0" />
          <span className="flex-1">{error}</span>
        </div>
      ) : null}

      {truncated ? (
        <div className="border-amber-500/30 border-b bg-amber-500/10 px-3 py-1.5 text-amber-700 text-xs dark:text-amber-300">
          File larger than 256 KiB — showing the first chunk, read-only.
        </div>
      ) : null}

      {remoteUpdate ? (
        <div className="flex items-center justify-between gap-2 border-amber-500/30 border-b bg-amber-500/10 px-3 py-1.5 text-amber-700 text-xs dark:text-amber-300">
          <span>The agent changed this file. You have unsaved edits.</span>
          <button
            type="button"
            onClick={() => void load()}
            className="flex items-center gap-1 rounded-md border border-amber-500/40 px-2 py-0.5 font-medium text-[11px] hover:bg-amber-500/10"
          >
            <RefreshCw className="h-3 w-3" /> Discard + reload
          </button>
        </div>
      ) : null}

      <div className={cn('flex-1', loading ? 'opacity-50' : '')}>
        <EditorMonaco
          height="100%"
          theme="vs-dark"
          language={language}
          value={content}
          onChange={(v) => setContent(v ?? '')}
          options={{
            minimap: { enabled: false },
            fontSize: 12,
            fontFamily: 'var(--font-geist-mono), monospace',
            wordWrap: 'on',
            readOnly: truncated,
            scrollBeyondLastLine: false,
          }}
        />
      </div>
    </div>
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
