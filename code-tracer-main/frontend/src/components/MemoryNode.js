/**
 * MemoryNode.js — Custom React Flow node for the pointer graph.
 *
 * Renders a single variable as a card with:
 *   - Name, type badge, current value
 *   - Pointer target label (human-readable, not raw address)
 *   - Alias badge when multiple pointers share a target
 *   - Change highlighting (amber glow when value changed)
 *   - NULL indicator for null pointers
 */

import React, { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

const MemoryNode = memo(({ data }) => {
  const {
    name,
    varType,
    value,
    pointerDepth,
    isPointer,
    isNull,
    pointsTo,
    changed,
    aliasGroup,
  } = data;

  // Color scheme based on pointer depth
  const colorScheme = {
    0: { bg: '#18181B', border: '#27272A', accent: '#3B82F6', label: 'Value' },
    1: { bg: '#1a1710', border: 'rgba(245, 158, 11, 0.3)', accent: '#F59E0B', label: 'Pointer' },
    2: { bg: '#1a1018', border: 'rgba(168, 85, 247, 0.3)', accent: '#A855F7', label: 'Ptr→Ptr' },
  };
  const scheme = colorScheme[Math.min(pointerDepth, 2)] || colorScheme[2];

  return (
    <div
      data-testid={`pgraph-node-${name}`}
      style={{
        background: scheme.bg,
        border: `1.5px solid ${changed ? 'rgba(251, 191, 36, 0.6)' : scheme.border}`,
        borderRadius: 8,
        padding: '10px 14px',
        minWidth: 160,
        maxWidth: 220,
        boxShadow: changed
          ? '0 0 16px rgba(251, 191, 36, 0.15)'
          : '0 2px 8px rgba(0,0,0,0.3)',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      {/* Target handle (top) — pointers connect here */}
      <Handle
        type="target"
        position={Position.Top}
        style={{
          background: scheme.accent,
          border: `2px solid ${scheme.bg}`,
          width: 8,
          height: 8,
        }}
      />

      {/* Header: name + type badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 13,
            fontWeight: 600,
            color: '#93C5FD',
          }}
        >
          {name}
        </span>
        <span
          style={{
            fontSize: 9,
            padding: '1px 6px',
            borderRadius: 3,
            background: `${scheme.accent}15`,
            color: scheme.accent,
            fontFamily: "'JetBrains Mono', monospace",
            letterSpacing: '0.03em',
          }}
        >
          {varType}
        </span>
      </div>

      {/* Value */}
      <div
        style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 14,
          fontWeight: changed ? 700 : 500,
          color: changed ? '#FBBF24' : isNull ? '#EF4444' : '#10B981',
          marginBottom: isPointer ? 6 : 0,
          transition: 'color 0.2s ease',
        }}
      >
        {isNull ? 'NULL' : String(value ?? '?')}
      </div>

      {/* Pointer target label */}
      {isPointer && pointsTo && !isNull && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            fontSize: 10,
            color: scheme.accent,
            opacity: 0.8,
            fontFamily: "'JetBrains Mono', monospace",
          }}
        >
          <svg width="14" height="8" style={{ flexShrink: 0 }}>
            <line x1="0" y1="4" x2="10" y2="4" stroke={scheme.accent} strokeWidth="1.5" />
            <polygon points="8,1 14,4 8,7" fill={scheme.accent} />
          </svg>
          <span>{pointsTo}</span>
        </div>
      )}

      {/* Alias badge */}
      {aliasGroup && aliasGroup.pointerNames.length >= 2 && (
        <div
          style={{
            marginTop: 6,
            fontSize: 9,
            padding: '2px 6px',
            borderRadius: 3,
            background: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid rgba(99, 102, 241, 0.2)',
            color: '#818CF8',
            fontFamily: "'IBM Plex Sans', sans-serif",
          }}
        >
          Alias: {aliasGroup.pointerNames.join(', ')} → {aliasGroup.targetNames.join(', ')}
        </div>
      )}

      {/* Source handle (bottom) — edges originate here */}
      {isPointer && !isNull && (
        <Handle
          type="source"
          position={Position.Bottom}
          style={{
            background: scheme.accent,
            border: `2px solid ${scheme.bg}`,
            width: 8,
            height: 8,
          }}
        />
      )}
    </div>
  );
});

MemoryNode.displayName = 'MemoryNode';

export default MemoryNode;
