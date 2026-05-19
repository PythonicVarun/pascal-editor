#!/usr/bin/env node
// Pack @pascal-app/mcp into a single tarball that installs cleanly with
// `npm install -g` inside the agent container. Bun workspaces leave
// `workspace:*` literals behind in package.json files; we rewrite mcp's
// @pascal-app/core dep to a `file:./vendor/core` pointer and copy the built
// core into vendor/ so npm sees a self-contained package.
//
// Output: /out/pascal-app-mcp.tgz (inside the Docker build's pack stage),
// or ./out/pascal-app-mcp.tgz when run from the repo root.

import { execSync } from 'node:child_process'
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve(process.argv[2] ?? process.cwd())
const outDir = path.resolve(process.argv[3] ?? path.join(repoRoot, 'out'))
const stageRoot = path.join(outDir, 'stage-mcp')

console.log(`[pack] repo=${repoRoot} out=${outDir}`)

rmSync(stageRoot, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
mkdirSync(stageRoot, { recursive: true })
mkdirSync(path.join(stageRoot, 'vendor', 'core'), { recursive: true })

// 1. Copy mcp package's published surface (dist + manifest + readme).
const mcpSrc = path.join(repoRoot, 'packages', 'mcp')
cpSync(path.join(mcpSrc, 'dist'), path.join(stageRoot, 'dist'), { recursive: true })
const mcpPkg = JSON.parse(readFileSync(path.join(mcpSrc, 'package.json'), 'utf8'))
for (const name of ['README.md', 'CHANGELOG.md']) {
  try {
    cpSync(path.join(mcpSrc, name), path.join(stageRoot, name))
  } catch {
    // Optional sidecar; tarball is still valid without it.
  }
}

// 2. Copy built core into vendor/core, along with a minimal manifest that
//    matches what mcp imports (subpath exports + main). We keep core's
//    full package.json so subpath exports resolve identically to the
//    workspace setup.
const coreSrc = path.join(repoRoot, 'packages', 'core')
cpSync(path.join(coreSrc, 'dist'), path.join(stageRoot, 'vendor', 'core', 'dist'), {
  recursive: true,
})
const corePkg = JSON.parse(readFileSync(path.join(coreSrc, 'package.json'), 'utf8'))
// Strip workspace-only fields, keep exports / main / types / runtime deps.
delete corePkg.devDependencies
delete corePkg.scripts
delete corePkg.publishConfig
writeFileSync(
  path.join(stageRoot, 'vendor', 'core', 'package.json'),
  JSON.stringify(corePkg, null, 2),
)

// 3. Rewrite mcp's manifest so the bundled core wins over any registry
//    fetch attempt. file: dependencies have to be in `dependencies`, not
//    peerDependencies — npm refuses to install a file: peer.
//
//    npm does NOT recursively install dependencies of a `file:` package
//    when it lives inside a published tarball (it treats the vendored
//    tree as already-installed). So we lift core's runtime deps into
//    mcp's own `dependencies` — that's the only set npm will install at
//    the top level. We skip core's React/Three peer deps; the MCP
//    server doesn't import any DOM-bound module from core at runtime.
const rewritten = {
  ...mcpPkg,
  dependencies: {
    ...(mcpPkg.dependencies ?? {}),
    ...(corePkg.dependencies ?? {}),
    // zustand (vendored via core) imports react eagerly from its main
    // entry, even when only its vanilla store API is used. Provide a
    // minimal React install so the MCP process can boot.
    react: '^19.0.0',
    '@pascal-app/core': 'file:./vendor/core',
  },
  files: ['dist', 'vendor', 'README.md', 'CHANGELOG.md'],
}
if (rewritten.peerDependencies?.['@pascal-app/core']) {
  delete rewritten.peerDependencies['@pascal-app/core']
}
if (rewritten.devDependencies?.['@pascal-app/core']) {
  delete rewritten.devDependencies['@pascal-app/core']
}
delete rewritten.scripts
writeFileSync(path.join(stageRoot, 'package.json'), JSON.stringify(rewritten, null, 2))

// 4. npm pack inside the staging dir → produces pascal-app-mcp-<ver>.tgz.
const before = new Set(readdirSync(outDir).filter((f) => f.endsWith('.tgz')))
execSync(`npm pack --pack-destination ${JSON.stringify(outDir)}`, {
  cwd: stageRoot,
  stdio: 'inherit',
})
const after = readdirSync(outDir).filter((f) => f.endsWith('.tgz'))
const fresh = after.find((f) => !before.has(f))
if (!fresh) {
  throw new Error('[pack] npm pack did not produce a new tarball')
}
// 5. Normalize the filename so the Dockerfile can reference it without
//    knowing the version.
const finalPath = path.join(outDir, 'pascal-app-mcp.tgz')
if (fresh !== 'pascal-app-mcp.tgz') {
  cpSync(path.join(outDir, fresh), finalPath)
  rmSync(path.join(outDir, fresh))
}
console.log(`[pack] wrote ${finalPath}`)
