import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  useReactFlow,
  type Node,
  type Edge,
  type Connection,
  type NodeMouseHandler,
} from '@xyflow/react';
import { useTreeStore } from '../store/treeStore';
import { layoutTree } from '../lib/layout';
import { PersonNode, type PersonNodeData } from './PersonNode';
import { fullName, type Person } from '../types';

const nodeTypes = { person: PersonNode };

function matches(p: Person, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  return (
    fullName(p).toLowerCase().includes(needle) ||
    (p.occupation ?? '').toLowerCase().includes(needle) ||
    (p.birthPlace ?? '').toLowerCase().includes(needle)
  );
}

function Flow({ onEdit }: { onEdit: (id: string) => void }) {
  const people = useTreeStore((s) => s.people);
  const relationships = useTreeStore((s) => s.relationships);
  const selectedId = useTreeStore((s) => s.selectedId);
  const search = useTreeStore((s) => s.search);
  const dark = useTreeStore((s) => s.dark);
  const layoutTick = useTreeStore((s) => s.layoutTick);
  const setSelected = useTreeStore((s) => s.setSelected);
  const addRelationship = useTreeStore((s) => s.addRelationship);
  const removeRelationship = useTreeStore((s) => s.removeRelationship);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node<PersonNodeData>>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView } = useReactFlow();
  const didInit = useRef(false);

  // Sync nodes from people, preserving existing positions.
  useEffect(() => {
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return people.map((p) => {
        const existing = byId.get(p.id);
        return {
          id: p.id,
          type: 'person',
          position: existing?.position ?? { x: 100, y: 100 },
          selected: p.id === selectedId,
          data: { person: p, dimmed: search.trim() ? !matches(p, search) : false },
        } as Node<PersonNodeData>;
      });
    });
  }, [people, search, selectedId, setNodes]);

  // Sync edges from relationships.
  useEffect(() => {
    const next: Edge[] = relationships.map((r) =>
      r.type === 'parent'
        ? {
            id: r.id,
            source: r.parentId,
            target: r.childId,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'smoothstep',
            style: { stroke: '#f54e00', strokeWidth: 2 },
          }
        : {
            id: r.id,
            source: r.aId,
            target: r.bId,
            sourceHandle: 'right',
            targetHandle: 'left',
            type: 'straight',
            style: { stroke: '#cf2d56', strokeWidth: 2, strokeDasharray: '5 5' },
          },
    );
    setEdges(next);
  }, [relationships, setEdges]);

  const doLayout = useCallback(() => {
    const positioned = layoutTree(people, relationships);
    const map = new Map(positioned.map((p) => [p.id, p]));
    setNodes((prev) =>
      prev.map((n) => {
        const pos = map.get(n.id);
        return pos ? { ...n, position: { x: pos.x, y: pos.y } } : n;
      }),
    );
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 400 }));
  }, [people, relationships, setNodes, fitView]);

  // Layout once on first mount, and whenever the toolbar requests it.
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      doLayout();
      return;
    }
    doLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutTick]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      const spouse =
        c.sourceHandle === 'right' ||
        c.sourceHandle === 'left' ||
        c.targetHandle === 'left' ||
        c.targetHandle === 'right';
      if (spouse) addRelationship({ type: 'spouse', aId: c.source, bId: c.target });
      else addRelationship({ type: 'parent', parentId: c.source, childId: c.target });
    },
    [addRelationship],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => deleted.forEach((e) => removeRelationship(e.id)),
    [removeRelationship],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      setSelected(node.id);
      onEdit(node.id);
    },
    [setSelected, onEdit],
  );

  const minimapColor = useMemo(
    () => (dark ? 'rgba(255,255,255,0.15)' : 'rgba(38,37,30,0.12)'),
    [dark],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onEdgesDelete={onEdgesDelete}
      onNodeClick={onNodeClick}
      onPaneClick={() => setSelected(null)}
      colorMode={dark ? 'dark' : 'light'}
      fitView
      minZoom={0.2}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{ deletable: true }}
    >
      <Background variant={BackgroundVariant.Dots} gap={22} size={1.5} color={minimapColor} />
      <Controls showInteractive={false} className="!shadow-float" />
      <MiniMap
        pannable
        zoomable
        nodeColor={(n) => {
          const g = (n.data as PersonNodeData)?.person?.gender;
          return g === 'male' ? '#4f86c6' : g === 'female' ? '#cf6d8a' : '#9b9890';
        }}
        maskColor={dark ? 'rgba(0,0,0,0.4)' : 'rgba(242,241,237,0.6)'}
        className="!rounded-brand !overflow-hidden !shadow-float"
      />
    </ReactFlow>
  );
}

export function Canvas({ onEdit }: { onEdit: (id: string) => void }) {
  return (
    <ReactFlowProvider>
      <Flow onEdit={onEdit} />
    </ReactFlowProvider>
  );
}
