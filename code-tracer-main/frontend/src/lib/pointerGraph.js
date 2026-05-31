/**
 * pointerGraph.js — Pure data module for pointer graph construction.
 *
 * Converts a memory snapshot (variables with addresses) into a graph model
 * of nodes and edges suitable for React Flow.
 *
 * This module has ZERO React dependencies — it's pure functions over data.
 *
 * Input format (per variable):
 *   { name, type, address?, value }
 *
 * The backend currently sends { name, value, type } without addresses.
 * When addresses ARE present, we build pointer edges by resolving
 * pointer values (addresses) to actual variable names.
 */

// ---------------------------------------------------------------------------
//  1. Type classification
// ---------------------------------------------------------------------------

/**
 * Determine the "pointer depth" of a type string.
 *   "int"    → 0  (value type)
 *   "int*"   → 1  (single pointer)
 *   "int**"  → 2  (double pointer)
 *   "pointer"→ 1  (generic backend type)
 */
export function pointerDepth(typeStr) {
  if (!typeStr) return 0;
  const t = typeStr.trim();
  if (t === 'pointer') return 1;
  // Count trailing *'s
  let depth = 0;
  for (let i = t.length - 1; i >= 0; i--) {
    if (t[i] === '*') depth++;
    else break;
  }
  return depth;
}

/**
 * Returns true if the type string represents any pointer type.
 */
export function isPointerType(typeStr) {
  return pointerDepth(typeStr) > 0;
}

/**
 * Returns true if the value looks like a memory address (0x...).
 */
export function isAddress(value) {
  if (typeof value !== 'string') return false;
  return /^0x[0-9a-fA-F]+$/i.test(value);
}

/**
 * Returns true if the pointer value represents NULL.
 */
export function isNullPointer(value) {
  if (value === null || value === undefined || value === '') return true;
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    return v === '0x0' || v === '(nil)' || v === 'null' || v === '0';
  }
  return false;
}

// ---------------------------------------------------------------------------
//  2. Address → variable resolution
// ---------------------------------------------------------------------------

/**
 * Build a lookup map: address → [variable names at that address].
 * Multiple variables can share the same address (aliases / same slot).
 */
export function buildAddressMap(memory) {
  const map = {}; // address → [varName, ...]
  for (const v of memory) {
    if (v.address) {
      const addr = v.address.toLowerCase();
      if (!map[addr]) map[addr] = [];
      map[addr].push(v.name);
    }
  }
  return map;
}

/**
 * Resolve a pointer's value (an address) to the variable name(s) it
 * points to. Returns null if the address doesn't map to any known variable.
 */
export function resolvePointerTarget(pointerValue, addressMap) {
  if (isNullPointer(pointerValue)) return null;
  if (!isAddress(pointerValue)) return null;
  const addr = pointerValue.toLowerCase();
  return addressMap[addr] || null;
}

// ---------------------------------------------------------------------------
//  3. Alias detection
// ---------------------------------------------------------------------------

/**
 * Find all groups of pointers that point to the same target address.
 * Returns a map: address → { targetNames: [...], pointerNames: [...] }
 */
export function detectAliases(memory, addressMap) {
  const pointers = memory.filter(v => isPointerType(v.type) && !isNullPointer(v.value));
  // Group pointers by the address they point TO
  const groups = {};
  for (const p of pointers) {
    if (!isAddress(p.value)) continue;
    const targetAddr = p.value.toLowerCase();
    if (!groups[targetAddr]) groups[targetAddr] = [];
    groups[targetAddr].push(p.name);
  }
  // Only keep groups with 2+ pointers (actual aliases)
  const aliases = {};
  for (const [addr, names] of Object.entries(groups)) {
    if (names.length >= 2) {
      aliases[addr] = {
        pointerNames: names,
        targetNames: addressMap[addr] || [addr],
      };
    }
  }
  return aliases;
}

// ---------------------------------------------------------------------------
//  4. Graph construction (the main export)
// ---------------------------------------------------------------------------

/**
 * Convert a memory snapshot into { nodes, edges } for React Flow.
 *
 * Layout strategy:
 *   Row 0 (y=0):   value types (int, char, float, etc.)
 *   Row 1 (y=160):  single pointers (int*, char*)
 *   Row 2 (y=320):  double pointers (int**, etc.)
 *   Row 3+ :        deeper pointer chains
 *
 * Each node carries custom data for rendering.
 */

const NODE_WIDTH = 200;
const NODE_GAP_X = 40;
const ROW_GAP_Y = 160;

export function buildPointerGraph(memory, prevMemory = null) {
  if (!memory || memory.length === 0) return { nodes: [], edges: [], aliases: {} };

  const addressMap = buildAddressMap(memory);
  const aliases = detectAliases(memory, addressMap);

  // Track which variables changed since previous step
  const prevMap = {};
  if (prevMemory) {
    for (const v of prevMemory) {
      prevMap[v.name] = v.value;
    }
  }

  // Group variables by pointer depth for layout rows
  const rows = {}; // depth → [variable, ...]
  for (const v of memory) {
    const depth = pointerDepth(v.type);
    if (!rows[depth]) rows[depth] = [];
    rows[depth].push(v);
  }

  // Build nodes
  const nodes = [];
  const nodePositions = {}; // varName → { x, y }

  // Sort row keys so value types come first
  const sortedDepths = Object.keys(rows).map(Number).sort((a, b) => a - b);

  for (const depth of sortedDepths) {
    const rowVars = rows[depth];
    const rowY = depth * ROW_GAP_Y;

    for (let i = 0; i < rowVars.length; i++) {
      const v = rowVars[i];
      const x = i * (NODE_WIDTH + NODE_GAP_X);
      const y = rowY;
      const changed = prevMap.hasOwnProperty(v.name) && String(prevMap[v.name]) !== String(v.value);

      // Find what this pointer points to (human-readable target)
      let pointsTo = null;
      let pointsToRaw = null;
      if (isPointerType(v.type)) {
        if (isNullPointer(v.value)) {
          pointsTo = 'NULL';
        } else {
          const targets = resolvePointerTarget(v.value, addressMap);
          pointsTo = targets ? targets.join(', ') : v.value;
          pointsToRaw = v.value;
        }
      }

      // Check if this variable is part of an alias group
      let aliasGroup = null;
      if (isPointerType(v.type) && isAddress(v.value)) {
        const addr = v.value.toLowerCase();
        if (aliases[addr]) {
          aliasGroup = aliases[addr];
        }
      }

      nodePositions[v.name] = { x, y };

      nodes.push({
        id: v.name,
        type: 'memoryNode',
        position: { x, y },
        data: {
          name: v.name,
          varType: v.type,
          value: v.value,
          address: v.address || null,
          pointerDepth: pointerDepth(v.type),
          isPointer: isPointerType(v.type),
          isNull: isPointerType(v.type) && isNullPointer(v.value),
          pointsTo,
          pointsToRaw,
          changed,
          aliasGroup,
        },
      });
    }
  }

  // Build edges (pointer → target variable)
  const edges = [];
  for (const v of memory) {
    if (!isPointerType(v.type) || isNullPointer(v.value) || !isAddress(v.value)) continue;

    const targetNames = resolvePointerTarget(v.value, addressMap);
    if (!targetNames) continue;

    // Edge to the first target (usually there's only one variable per address)
    const targetName = targetNames[0];
    const prevVal = prevMap[v.name];
    const edgeChanged = prevMap.hasOwnProperty(v.name) && String(prevVal) !== String(v.value);

    edges.push({
      id: `${v.name}->${targetName}`,
      source: v.name,
      target: targetName,
      type: 'smoothstep',
      animated: edgeChanged,
      style: {
        stroke: edgeChanged ? '#FBBF24' : '#6366F1',
        strokeWidth: edgeChanged ? 2.5 : 1.5,
      },
      markerEnd: {
        type: 'arrowclosed',
        color: edgeChanged ? '#FBBF24' : '#6366F1',
        width: 16,
        height: 16,
      },
      label: edgeChanged ? 'changed' : undefined,
      labelStyle: { fill: '#FBBF24', fontSize: 9, fontFamily: 'JetBrains Mono' },
    });
  }

  return { nodes, edges, aliases };
}

// ---------------------------------------------------------------------------
//  5. Diff utility — detect what changed between two snapshots
// ---------------------------------------------------------------------------

export function diffSnapshots(current, previous) {
  if (!previous) return new Set(current.map(v => v.name));
  const prevMap = {};
  for (const v of previous) prevMap[v.name] = String(v.value);
  const changed = new Set();
  for (const v of current) {
    if (!prevMap.hasOwnProperty(v.name) || prevMap[v.name] !== String(v.value)) {
      changed.add(v.name);
    }
  }
  return changed;
}
