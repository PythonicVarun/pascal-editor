import { AGENT_RUNNER_URL } from './agent-runner-client'

export interface FsNode {
  name: string
  /** Path relative to the project root, POSIX separators. "" for root. */
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  children?: FsNode[]
}

export interface FsFile {
  content: string
  /** Sidecar truncates reads at 256 KiB. */
  truncated: boolean
  size: number
}

async function jsonOrThrow<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `agent-runner fs ${res.status}`)
  }
  return res.json() as Promise<T>
}

export async function readTree(projectId: string): Promise<FsNode> {
  const res = await fetch(`${AGENT_RUNNER_URL}/api/projects/${projectId}/fs/tree`, {
    cache: 'no-store',
  })
  return jsonOrThrow<FsNode>(res)
}

export async function readFile(projectId: string, relPath: string): Promise<FsFile> {
  const url = new URL(`${AGENT_RUNNER_URL}/api/projects/${projectId}/fs/file`)
  url.searchParams.set('path', relPath)
  const res = await fetch(url.toString(), { cache: 'no-store' })
  return jsonOrThrow<FsFile>(res)
}

/**
 * Upload (overwrite) a single file. The sidecar handler is a raw-body POST
 * that takes ?dir= and ?name= in the query string.
 */
export async function writeFile(
  projectId: string,
  relPath: string,
  contents: string,
): Promise<void> {
  // Split the relative path into dir + name. resolveSafe in the sidecar
  // normalizes empty dir as "" (project root).
  const slash = relPath.lastIndexOf('/')
  const dir = slash >= 0 ? relPath.slice(0, slash) : ''
  const name = slash >= 0 ? relPath.slice(slash + 1) : relPath
  const url = new URL(`${AGENT_RUNNER_URL}/api/projects/${projectId}/fs/upload`)
  url.searchParams.set('dir', dir)
  url.searchParams.set('name', name)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'content-type': 'application/octet-stream' },
    body: contents,
  })
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(body?.error ?? `agent-runner fs ${res.status}`)
  }
}

/** Best-guess Monaco language id from a file extension. */
export function monacoLanguageFor(relPath: string): string {
  const ext = relPath.toLowerCase().split('.').pop() ?? ''
  switch (ext) {
    case 'js':
    case 'mjs':
    case 'cjs':
      return 'javascript'
    case 'jsx':
      return 'javascript'
    case 'ts':
    case 'mts':
    case 'cts':
      return 'typescript'
    case 'tsx':
      return 'typescript'
    case 'json':
      return 'json'
    case 'md':
    case 'markdown':
      return 'markdown'
    case 'py':
      return 'python'
    case 'sh':
    case 'bash':
      return 'shell'
    case 'yml':
    case 'yaml':
      return 'yaml'
    case 'toml':
      return 'ini'
    case 'html':
    case 'htm':
      return 'html'
    case 'css':
      return 'css'
    default:
      return 'plaintext'
  }
}
