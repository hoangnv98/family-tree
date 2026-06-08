import { memo } from 'react';
import { Handle, Position } from '@xyflow/react';

export const JUNCTION_SIZE = 12;

/**
 * Tiny invisible-ish knot placed at the midpoint of a couple. The marriage line
 * passes through it and a single shared line drops from its bottom handle to all
 * the couple's children.
 */
function JunctionNodeComponent() {
  return (
    <div
      className="rounded-full bg-accent ring-2 ring-canvas dark:ring-surface-500"
      style={{ width: JUNCTION_SIZE, height: JUNCTION_SIZE }}
    >
      <Handle id="jt" type="target" position={Position.Top} className="!opacity-0" />
      <Handle id="jb" type="source" position={Position.Bottom} className="!opacity-0" />
    </div>
  );
}

export const JunctionNode = memo(JunctionNodeComponent);
