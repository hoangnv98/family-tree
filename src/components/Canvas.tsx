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
  getNodesBounds,
  getViewportForBounds,
  type Node,
  type Edge,
  type Connection,
  type NodeMouseHandler,
} from '@xyflow/react';
import { toPng } from 'html-to-image';
import { useTreeStore } from '../store/treeStore';
import { layoutTree, NODE_WIDTH, NODE_HEIGHT } from '../lib/layout';
import { computeUnions } from '../lib/unions';
import { resolveMarriedIn } from '../lib/marriage';
import { PersonNode, type PersonNodeData } from './PersonNode';
import { JunctionNode, JUNCTION_SIZE } from './JunctionNode';
import { fullName, type Person } from '../types';

const nodeTypes = { person: PersonNode, junction: JunctionNode };

const ORANGE = '#f54e00';
const CRIMSON = '#cf2d56';

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
  const pngTick = useTreeStore((s) => s.pngTick);
  const setSelected = useTreeStore((s) => s.setSelected);
  const addRelationship = useTreeStore((s) => s.addRelationship);
  const removeRelationship = useTreeStore((s) => s.removeRelationship);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView, getNodes } = useReactFlow();
  const didInit = useRef(false);

  const unions = useMemo(() => computeUnions(relationships), [relationships]);

  // Parent-pairs that are an actual married couple (have a spouse link). Only
  // these get a shared junction knot; other multi-parent children (con riêng)
  // are drawn with separate dashed lines so they don't look like a couple.
  const coupleKeys = useMemo(() => {
    const s = new Set<string>();
    for (const r of relationships) {
      if (r.type === 'spouse') s.add([r.aId, r.bId].sort().join('+'));
    }
    return s;
  }, [relationships]);

  const isCoupleUnion = useCallback(
    (parentIds: string[]) => parentIds.length === 2 && coupleKeys.has(parentIds.join('+')),
    [coupleKeys],
  );

  // Married-in spouses: sit next to their partner; their link to birth parents
  // is drawn as a thin "origin" line, and the marriage line is forced to run
  // anchor → mover (left → right) so it stays a clean short connector.
  const married = useMemo(() => resolveMarriedIn(relationships), [relationships]);
  const moverIds = useMemo(() => new Set(married.map((m) => m.moverId)), [married]);
  const relocatedPair = useMemo(() => {
    const m = new Map<string, { anchor: string; mover: string }>();
    for (const x of married) {
      m.set([x.moverId, x.anchorId].sort().join('+'), { anchor: x.anchorId, mover: x.moverId });
    }
    return m;
  }, [married]);

  // Sync person nodes from people, preserving existing positions.
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

  // Derive junction "knot" nodes from the live person positions (one per couple
  // with children). They are not stored in state — they follow the parents.
  const junctionNodes = useMemo<Node[]>(() => {
    const posById = new Map(nodes.map((n) => [n.id, n.position]));
    const out: Node[] = [];
    for (const u of unions) {
      if (!isCoupleUnion(u.parentIds)) continue;
      const centers = u.parentIds
        .map((id) => posById.get(id))
        .filter((p): p is { x: number; y: number } => !!p)
        .map((p) => ({ x: p.x + NODE_WIDTH / 2, y: p.y + NODE_HEIGHT / 2 }));
      if (centers.length < 2) continue;
      const cx = centers.reduce((s, c) => s + c.x, 0) / centers.length;
      const cy = centers.reduce((s, c) => s + c.y, 0) / centers.length;
      out.push({
        id: u.id,
        type: 'junction',
        position: { x: cx - JUNCTION_SIZE / 2, y: cy - JUNCTION_SIZE / 2 },
        data: {},
        draggable: false,
        selectable: false,
        deletable: false,
      });
    }
    return out;
  }, [unions, nodes, isCoupleUnion]);

  const allNodes = useMemo(() => [...nodes, ...junctionNodes], [nodes, junctionNodes]);

  // Build edges: marriage lines (spouse) + one shared line per union to children.
  useEffect(() => {
    const next: Edge[] = [];

    // marriage lines — soft bezier. For a relocated couple, force anchor → mover
    // direction so the line is a clean short connector between adjacent cards.
    for (const r of relationships) {
      if (r.type !== 'spouse') continue;
      const rel = relocatedPair.get([r.aId, r.bId].sort().join('+'));
      next.push({
        id: r.id,
        source: rel ? rel.anchor : r.aId,
        target: rel ? rel.mover : r.bId,
        sourceHandle: 'right',
        targetHandle: 'left',
        type: 'default',
        selectable: true,
        style: { stroke: CRIMSON, strokeWidth: 2, strokeDasharray: '5 5' },
      });
    }

    // A child that is a married-in spouse: its link to birth parents is a thin,
    // faint "origin" line so it doesn't compete with the main family lines.
    const childStyle = (childId: string, base: Record<string, unknown>) =>
      moverIds.has(childId)
        ? { stroke: '#b3ada3', strokeWidth: 1.5, strokeDasharray: '2 5', opacity: 0.7 }
        : base;

    // parent → child links
    for (const u of unions) {
      if (isCoupleUnion(u.parentIds)) {
        // real couple: one shared line from the junction knot to every child
        for (const childId of u.childIds) {
          next.push({
            id: `${u.id}__${childId}`,
            source: u.id,
            target: childId,
            sourceHandle: 'jb',
            targetHandle: 'top',
            type: 'smoothstep',
            pathOptions: { borderRadius: 16 },
            style: childStyle(childId, { stroke: ORANGE, strokeWidth: 2 }),
          } as Edge);
        }
      } else {
        // single parent (solid) or con riêng / non-couple parents (dashed):
        // a separate line straight from each parent to each child.
        const dashed = u.parentIds.length >= 2;
        const base = {
          stroke: ORANGE,
          strokeWidth: 2,
          ...(dashed ? { strokeDasharray: '6 5', opacity: 0.85 } : {}),
        };
        for (const parentId of u.parentIds) {
          for (const childId of u.childIds) {
            next.push({
              id: `${parentId}__${childId}`,
              source: parentId,
              target: childId,
              sourceHandle: 'bottom',
              targetHandle: 'top',
              type: 'smoothstep',
              pathOptions: { borderRadius: 16 },
              style: childStyle(childId, base),
            } as Edge);
          }
        }
      }
    }

    setEdges(next);
  }, [relationships, unions, isCoupleUnion, moverIds, relocatedPair, setEdges]);

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

  // Export the whole tree as a PNG when the toolbar requests it.
  useEffect(() => {
    if (pngTick === 0) return;
    const viewportEl = document.querySelector('.react-flow__viewport') as HTMLElement | null;
    if (!viewportEl) return;
    const bounds = getNodesBounds(getNodes());
    if (!bounds.width || !bounds.height) return;
    const imageWidth = Math.max(Math.round(bounds.width) + 200, 600);
    const imageHeight = Math.max(Math.round(bounds.height) + 200, 400);
    const t = getViewportForBounds(bounds, imageWidth, imageHeight, 0.5, 2, 0.12);

    // React Flow's edge <svg> is 0×0 with overflow:visible, so html-to-image
    // would clip every edge away. Give it explicit dimensions covering the
    // content for the duration of the capture, then restore.
    const svgW = Math.ceil(bounds.x + bounds.width + 200);
    const svgH = Math.ceil(bounds.y + bounds.height + 200);
    const edgeSvgs = Array.from(
      viewportEl.querySelectorAll<SVGElement>('.react-flow__edges'),
    );
    const restore = edgeSvgs.map((svg) => {
      const prev = { w: svg.style.width, h: svg.style.height };
      svg.style.width = `${svgW}px`;
      svg.style.height = `${svgH}px`;
      return () => {
        svg.style.width = prev.w;
        svg.style.height = prev.h;
      };
    });
    const cleanup = () => restore.forEach((fn) => fn());

    toPng(viewportEl, {
      backgroundColor: dark ? '#1c1b16' : '#f2f1ed',
      width: imageWidth,
      height: imageHeight,
      pixelRatio: 2,
      cacheBust: true,
      style: {
        width: `${imageWidth}px`,
        height: `${imageHeight}px`,
        transform: `translate(${t.x}px, ${t.y}px) scale(${t.zoom})`,
      },
    })
      .then((dataUrl) => {
        cleanup();
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = 'cay-gia-pha.png';
        a.click();
      })
      .catch((err) => {
        cleanup();
        console.error('PNG export failed', err);
        alert('Không tạo được ảnh PNG. Thử lại nhé.');
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pngTick]);

  const onConnect = useCallback(
    (c: Connection) => {
      if (!c.source || !c.target || c.source === c.target) return;
      // ignore connections involving junction nodes
      if (c.source.startsWith('u_') || c.target.startsWith('u_')) return;
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
    (deleted: Edge[]) =>
      deleted.forEach((e) => {
        if (e.source.startsWith('u_')) {
          // couple junction → child: detach the child from both parents
          const parentIds = e.source.slice(2).split('+');
          relationships.forEach((r) => {
            if (r.type === 'parent' && r.childId === e.target && parentIds.includes(r.parentId)) {
              removeRelationship(r.id);
            }
          });
          return;
        }
        // direct parent → child line
        const parentRel = relationships.find(
          (r) => r.type === 'parent' && r.parentId === e.source && r.childId === e.target,
        );
        if (parentRel) {
          removeRelationship(parentRel.id);
          return;
        }
        // otherwise it's a marriage line — edge id is the spouse relationship id
        removeRelationship(e.id);
      }),
    [removeRelationship, relationships],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type !== 'person') return;
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
      nodes={allNodes}
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
          if (n.type === 'junction') return ORANGE;
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
