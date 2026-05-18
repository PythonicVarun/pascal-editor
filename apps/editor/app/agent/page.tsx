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
const { createNodes, nodes } = sceneAPI;

// Find the first level
const levelId = Object.values(nodes).find(n => n.type === 'level')?.id;

if (!levelId) {
  console.log("No level found!");
} else {
  const houseSize = 8;
  const wallHeight = 3;
  const wallThickness = 0.2;
  
  // Generate IDs with underscores per schema requirements
  const slabId = 'slab_' + Math.random().toString(36).slice(2, 8);
  const wallIds = [1, 2, 3, 4].map(i => 'wall_' + Math.random().toString(36).slice(2, i+8));
  const doorId = 'door_' + Math.random().toString(36).slice(2, 8);
  const windowIds = [1, 2, 3].map(i => 'window_' + Math.random().toString(36).slice(2, i+8));
  const roofId = 'roof_' + Math.random().toString(36).slice(2, 8);
  const rsegId = 'rseg_' + Math.random().toString(36).slice(2, 8);

  const ops = [];

  // Slab (Floor)
  ops.push({
    node: {
      id: slabId,
      type: 'slab',
      polygon: [
        [0, 0], [houseSize, 0], [houseSize, houseSize], [0, houseSize]
      ],
      holes: [],
      holeMetadata: [],
      elevation: 0.05,
      autoFromWalls: false,
      visible: true,
      metadata: {}
    },
    parentId: levelId
  });

  // External Walls
  const wallCoords = [
    { start: [0, 0], end: [houseSize, 0] },
    { start: [houseSize, 0], end: [houseSize, houseSize] },
    { start: [houseSize, houseSize], end: [0, houseSize] },
    { start: [0, houseSize], end: [0, 0] }
  ];

  wallCoords.forEach((coords, i) => {
    ops.push({
      node: {
        id: wallIds[i],
        type: 'wall',
        start: coords.start,
        end: coords.end,
        height: wallHeight,
        thickness: wallThickness,
        children: i === 0 ? [doorId] : [windowIds[i - 1]],
        visible: true,
        metadata: {}
      },
      parentId: levelId
    });
  });

  // Front Door (on Wall 1)
  ops.push({
    node: {
      id: doorId,
      type: 'door',
      wallId: wallIds[0],
      position: [houseSize / 2, wallHeight / 2, 0],
      rotation: [0, 0, 0],
      width: 1.0,
      height: 2.1,
      doorCategory: 'interior',
      doorType: 'hinged',
      leafCount: 1,
      operationState: 0,
      slideDirection: 'left',
      trackStyle: 'none',
      garagePanelCount: 4,
      openingKind: 'door',
      openingShape: 'rectangle',
      openingRadiusMode: 'all',
      openingTopRadii: [0.15, 0.15],
      cornerRadius: 0.15,
      archHeight: 0.45,
      openingRevealRadius: 0.025,
      frameThickness: 0.05,
      frameDepth: 0.07,
      threshold: true,
      thresholdHeight: 0.02,
      hingesSide: 'left',
      swingDirection: 'inward',
      swingAngle: 0,
      handle: true,
      handleHeight: 1.05,
      handleSide: 'right',
      doorCloser: false,
      panicBar: false,
      panicBarHeight: 1.0,
      contentPadding: [0.04, 0.04],
      segments: [
        {
          type: 'panel',
          heightRatio: 0.4,
          columnRatios: [1],
          dividerThickness: 0.03,
          panelDepth: 0.01,
          panelInset: 0.04,
        },
        {
          type: 'panel',
          heightRatio: 0.6,
          columnRatios: [1],
          dividerThickness: 0.03,
          panelDepth: 0.01,
          panelInset: 0.04,
        }
      ],
      visible: true,
      metadata: {}
    },
    parentId: wallIds[0]
  });

  // Windows (on Walls 2, 3, 4)
  [1, 2, 3].forEach(i => {
    ops.push({
      node: {
        id: windowIds[i-1],
        type: 'window',
        wallId: wallIds[i],
        position: [houseSize / 2, 1.5, 0],
        rotation: [0, 0, 0],
        width: 1.2,
        height: 1.2,
        openingKind: 'window',
        windowType: 'fixed',
        operationState: 0,
        awningDirection: 'up',
        casementStyle: 'single',
        hingesSide: 'left',
        openingShape: 'rectangle',
        openingRadiusMode: 'all',
        openingCornerRadii: [0.15, 0.15, 0.15, 0.15],
        cornerRadius: 0.15,
        archHeight: 0.35,
        openingRevealRadius: 0.025,
        frameThickness: 0.05,
        frameDepth: 0.07,
        columnRatios: [1],
        rowRatios: [1],
        columnDividerThickness: 0.03,
        rowDividerThickness: 0.03,
        sill: true,
        sillDepth: 0.08,
        sillThickness: 0.03,
        visible: true,
        metadata: {}
      },
      parentId: wallIds[i]
    });
  });

  // Roof
  ops.push({
    node: {
      id: roofId,
      type: 'roof',
      position: [houseSize / 2, wallHeight, houseSize / 2],
      rotation: 0,
      children: [rsegId],
      visible: true,
      metadata: {}
    },
    parentId: levelId
  });

  ops.push({
    node: {
      id: rsegId,
      type: 'roof-segment',
      roofType: 'gable',
      position: [0, 0, 0],
      rotation: 0,
      width: houseSize + 1,
      depth: houseSize + 1,
      wallHeight: 0.2,
      roofHeight: 2.5,
      wallThickness: 0.1,
      deckThickness: 0.1,
      overhang: 0.3,
      shingleThickness: 0.05,
      visible: true,
      metadata: {}
    },
    parentId: roofId
  });

  createNodes(ops);
  console.log("Complete house built!");
}
`

export default function AgentPage() {
  const [code, setCode] = useState(DEFAULT_CODE)

  const handleRunCode = () => {
    try {
      const sceneAPI = useScene.getState()
      // Evaluate the code with sceneAPI in scope
      const fn = new Function('sceneAPI', code)
      fn(sceneAPI)
    } catch (err) {
      console.error("Agent Code Error:", err)
      alert(`Error executing code: ${err}`)
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
            projectId="agent-workspace"
            sidebarTabs={SIDEBAR_TABS}
            viewerToolbarLeft={<CommunityViewerToolbarLeft />}
            viewerToolbarRight={<CommunityViewerToolbarRight />}
          />
        </Panel>
      </Group>
    </div>
  )
}
