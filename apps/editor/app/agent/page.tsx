'use client'

import { useState } from 'react'
import { Editor, ItemsPanel } from '@pascal-app/editor'
import { Layers, Package, Settings, Play, Eraser, GripVertical } from 'lucide-react'
import EditorMonaco from '@monaco-editor/react'
import { useScene } from '@pascal-app/core'
import { Panel, Group, Separator } from 'react-resizable-panels'
import {
  CommunityViewerToolbarLeft,
  CommunityViewerToolbarRight,
} from '@/components/viewer-toolbar'

const SIDEBAR_TABS = [
  { id: 'site', label: 'Scene', component: () => null, mobileDefaultSnap: 0.5, mobileIcon: <Layers className="h-5 w-5" /> },
  { id: 'items', label: 'Items', component: ItemsPanel, mobileDefaultSnap: 0.5, mobileIcon: <Package className="h-5 w-5" /> },
  { id: 'settings', label: 'Settings', component: () => null, mobileDefaultSnap: 0.5, mobileIcon: <Settings className="h-5 w-5" /> },
]

const DEFAULT_CODE = `// Live Agent Code Editor
const { createNode, updateNode, nodes } = sceneAPI;

// Find the first level
const levelId = Object.values(nodes).find(n => n.type === 'level')?.id;

if (levelId) {
  const wallId = 'wall:' + Math.random().toString(36).slice(2, 8);
  
  // Create a 5m wall
  createNode({
    id: wallId,
    type: 'wall',
    start: [0, 0],
    end: [5, 0],
    height: 3,
    thickness: 0.2,
    children: [],
    visible: true,
    metadata: {}
  }, levelId);
  console.log("Wall created with id:", wallId);
} else {
  console.log("No level found!");
}
`

export default function DemoPage() {
  const [code, setCode] = useState(DEFAULT_CODE)

  const handleRunCode = () => {
    try {
      const sceneAPI = useScene.getState()
      // Evaluate the code with sceneAPI in scope
      const fn = new Function('sceneAPI', code)
      fn(sceneAPI)
    } catch (err) {
      console.error("Agent Code Error:", err)
      alert("Error executing code: " + err)
    }
  }

  const handleClearCode = () => {
    setCode('')
  }

  return (
    <div className="h-screen w-screen bg-background overflow-hidden">
      <Group orientation="horizontal">
        {/* LEFT PANEL - Agent / Code */}
        <Panel defaultSize={30} minSize={20} className="flex flex-col z-50 bg-background shadow-xl">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-foreground">Agent Workspace</h1>
              <p className="text-xs text-muted-foreground">Edit buildings live with code</p>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleClearCode}
                className="flex items-center gap-1.5 border border-border text-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-muted transition-colors"
              >
                <Eraser className="w-3 h-3" /> Clear
              </button>
              <button 
                onClick={handleRunCode}
                className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-1.5 rounded-md text-xs font-medium hover:bg-primary/90 transition-colors"
              >
                <Play className="w-3 h-3" /> Execute
              </button>
            </div>
          </div>
          <div className="flex-1 relative">
            <EditorMonaco
              height="100%"
              language="javascript"
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || '')}
              options={{
                minimap: { enabled: false },
                fontSize: 13,
                fontFamily: "var(--font-geist-mono), monospace",
                wordWrap: "on"
              }}
            />
          </div>
        </Panel>

        <Separator className="w-2 bg-border/50 hover:bg-border/80 transition-colors flex items-center justify-center cursor-col-resize z-50 group">
          <div className="w-1 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors flex items-center justify-center">
             <GripVertical className="w-3 h-3 text-muted-foreground scale-0 group-hover:scale-100 transition-transform" />
          </div>
        </Separator>
        
        {/* RIGHT PANEL - Pascal Editor */}
        <Panel defaultSize={70} className="relative h-full">
          <Editor
            layoutVersion="v2"
            projectId="agent-demo"
            sidebarTabs={SIDEBAR_TABS}
            viewerToolbarLeft={<CommunityViewerToolbarLeft />}
            viewerToolbarRight={<CommunityViewerToolbarRight />}
          />
        </Panel>
      </Group>
    </div>
  )
}
