/**
 * PointerGraph.js — Interactive pointer relationship visualization.
 *
 * Renders a React Flow graph where:
 *   - Each variable is a node (layered by pointer depth)
 *   - Pointer relationships are drawn as directed edges
 *   - Aliases are detected and labeled
 *   - Changed values glow amber on step transitions
 *
 * Usage:
 *   <PointerGraph memory={currentVariables} prevMemory={previousVariables} />
 *
 * The component is fully declarative — it recomputes the graph from scratch
 * on every render. No internal mutation.
 */

import React, { useMemo, useCallback } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  useNodesState,
  useEdgesState,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';

import MemoryNode from '@/components/MemoryNode';
import { buildPointerGraph, isPointerType } from '@/lib/pointerGraph';

// Register custom node types (must be stable reference — defined outside component)
const nodeTypes = { memoryNode: MemoryNode };

const PointerGraph = ({ memory = [], prevMemory = null }) => {
  // Build the graph model from the memory snapshot
  const { nodes: graphNodes, edges: graphEdges, aliases } = useMemo(
    () => buildPointerGraph(memory, prevMemory),
    [memory, prevMemory],
  );

  // Check if there are any pointer variables at all
  const hasPointers = useMemo(
    () => memory.some(v => isPointerType(v.type)),
    [memory],
  );

  // React Flow state (controlled by our computed graph)
  const [nodes, setNodes, onNodesChange] = useNodesState(graphNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(graphEdges);

  // Sync React Flow state when graph model changes
  React.useEffect(() => {
    setNodes(graphNodes);
    setEdges(graphEdges);
  }, [graphNodes, graphEdges, setNodes, setEdges]);

  // Prevent accidental edge connections
  const onConnect = useCallback(() => {}, []);

  // Alias summary
  const aliasSummary = useMemo(() => {
    const entries = Object.values(aliases);
    if (entries.length === 0) return null;
    return entries.map(a =>
      `${a.pointerNames.join(', ')} → ${a.targetNames.join(', ')}`
    );
  }, [aliases]);

  // Empty state — no pointers to visualize
  if (!hasPointers || memory.length === 0) {
    return (
      <div
        data-testid="pointer-graph-empty"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#52525B',
          fontFamily: "'IBM Plex Sans', sans-serif",
          fontSize: 13,
          gap: 8,
        }}
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#3F3F46" strokeWidth="1.5">
          <circle cx="12" cy="12" r="10" />
          <path d="M8 12h8M12 8v8" />
        </svg>
        <span>No pointer relationships to display</span>
        <span style={{ fontSize: 10, color: '#3F3F46' }}>
          Use code with pointers (int*, int**) to see the graph
        </span>
      </div>
    );
  }

  return (
    <div data-testid="pointer-graph" style={{ height: '100%', width: '100%', position: 'relative' }}>
      {/* Alias summary bar */}
      {aliasSummary && (
        <div
          data-testid="alias-summary"
          style={{
            position: 'absolute',
            top: 8,
            left: 8,
            zIndex: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 3,
          }}
        >
          {aliasSummary.map((text, i) => (
            <div
              key={i}
              style={{
                fontSize: 9,
                padding: '3px 8px',
                borderRadius: 4,
                background: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid rgba(99, 102, 241, 0.2)',
                color: '#818CF8',
                fontFamily: "'JetBrains Mono', monospace",
                backdropFilter: 'blur(8px)',
              }}
            >
              Alias: {text}
            </div>
          ))}
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1.2 }}
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        style={{ background: '#09090B' }}
        nodesDraggable={true}
        nodesConnectable={false}
        elementsSelectable={true}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#6366F1', strokeWidth: 1.5 },
        }}
      >
        <Background color="#1a1a1f" gap={20} size={1} />
        <Controls
          showInteractive={false}
          style={{
            background: '#18181B',
            border: '1px solid #27272A',
            borderRadius: 6,
          }}
        />
      </ReactFlow>
    </div>
  );
};

export default PointerGraph;
