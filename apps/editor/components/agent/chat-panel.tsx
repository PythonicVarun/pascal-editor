'use client'

import { useState } from 'react'
import { Send, Loader2 } from 'lucide-react'
import { sendChat } from '@/lib/agent-runner-client'

interface Props {
  projectId: string
  sessionId: string | null
}

export function ChatPanel({ projectId, sessionId }: Props) {
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const send = async () => {
    const trimmed = text.trim()
    if (!sessionId || trimmed.length === 0 || busy) return
    setBusy(true)
    setError(null)
    try {
      await sendChat(projectId, sessionId, trimmed)
      setText('')
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setBusy(false)
    }
  }

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Cmd/Ctrl-Enter to send, Shift-Enter for newline.
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      void send()
    }
  }

  return (
    <div className="flex flex-col border-border border-t bg-background">
      {error ? (
        <div className="border-destructive/30 border-b bg-destructive/10 px-3 py-1.5 text-destructive text-xs">
          {error}
        </div>
      ) : null}
      <div className="flex items-end gap-2 p-2">
        <textarea
          placeholder={
            sessionId
              ? 'Message the agent… (⌘↵ to send)'
              : 'Create a session to start chatting…'
          }
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKey}
          disabled={!sessionId}
          rows={2}
          className="flex-1 resize-none rounded-md border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => void send()}
          disabled={!sessionId || text.trim().length === 0 || busy}
          className="flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs hover:bg-primary/90 disabled:opacity-40"
        >
          {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
          Send
        </button>
      </div>
    </div>
  )
}
