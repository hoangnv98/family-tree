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
  type OnNodeDrag,
} from '@xyflow/react';
import { toPng } from 'html-to-image';
import { useTreeStore } from '../store/treeStore';
import { layoutTree, NODE_WIDTH, NODE_HEIGHT } from '../lib/layout';
import { layoutTreeVertical } from '../lib/layoutVertical';
import { computeUnions } from '../lib/unions';
import { resolveMarriedIn, marriedInIds } from '../lib/marriage';
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
  const fitTick = useTreeStore((s) => s.fitTick);
  const setSelected = useTreeStore((s) => s.setSelected);
  const addRelationship = useTreeStore((s) => s.addRelationship);
  const removeRelationship = useTreeStore((s) => s.removeRelationship);
  const readOnly = useTreeStore((s) => s.readOnly);
  const showInLaw = useTreeStore((s) => s.showInLaw);
  const layoutMode = useTreeStore((s) => s.layoutMode);
  const positions = useTreeStore((s) => s.positions);
  const setPosition = useTreeStore((s) => s.setPosition);
  const setPositions = useTreeStore((s) => s.setPositions);

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const { fitView, getNodes } = useReactFlow();
  const didInit = useRef(false);

  const unions = useMemo(() => computeUnions(relationships), [relationships]);

  // Married-in spouses (dâu / rể). The label itself is decided per-person from
  // gender at render time.
  const inLaw = useMemo(() => marriedInIds(relationships), [relationships]);

  const genderOf = useMemo(
    () => new Map(people.map((p) => [p.id, p.gender])),
    [people],
  );

  // How many spouses each person has — a 2+ count means a "vợ 2" family that the
  // vertical layout stacks, so its marriage lines route top→bottom instead.
  const spouseCount = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of relationships) {
      if (r.type !== 'spouse') continue;
      m.set(r.aId, (m.get(r.aId) ?? 0) + 1);
      m.set(r.bId, (m.get(r.bId) ?? 0) + 1);
    }
    return m;
  }, [relationships]);

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

  // A "vợ 2" couple: one parent has 2+ spouses. The vertical layout stacks the
  // wives, so children drop straight from the wife (mother) instead of going
  // through a shared junction far to the side.
  const isMultiWifeUnion = useCallback(
    (parentIds: string[]) => parentIds.some((p) => (spouseCount.get(p) ?? 0) >= 2),
    [spouseCount],
  );
  const motherOf = useCallback(
    (parentIds: string[]) =>
      parentIds.find((p) => (spouseCount.get(p) ?? 0) < 2) ?? parentIds[0],
    [spouseCount],
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

  // Sync person nodes from people, using saved positions (manual drags / last
  // auto-layout) first, then any live position, then a default.
  useEffect(() => {
    setNodes((prev) => {
      const byId = new Map(prev.map((n) => [n.id, n]));
      return people.map((p) => {
        const existing = byId.get(p.id);
        return {
          id: p.id,
          type: 'person',
          position: positions[p.id] ?? existing?.position ?? { x: 100, y: 100 },
          selected: p.id === selectedId,
          draggable: !readOnly,
          data: {
            person: p,
            dimmed: search.trim() ? !matches(p, search) : false,
            readOnly,
            inLawRole:
              showInLaw && inLaw.has(p.id)
                ? p.gender === 'female'
                  ? 'Dâu'
                  : p.gender === 'male'
                    ? 'Rể'
                    : null
                : null,
          },
        } as Node<PersonNodeData>;
      });
    });
  }, [people, search, selectedId, setNodes, readOnly, showInLaw, inLaw, positions]);

  // Derive junction "knot" nodes from the live person positions (one per couple
  // with children). They are not stored in state — they follow the parents.
  const junctionNodes = useMemo<Node[]>(() => {
    const posById = new Map(nodes.map((n) => [n.id, n.position]));
    const out: Node[] = [];
    for (const u of unions) {
      if (!isCoupleUnion(u.parentIds)) continue;
      if (isMultiWifeUnion(u.parentIds)) continue; // children drop from the mother
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
  }, [unions, nodes, isCoupleUnion, isMultiWifeUnion]);

  const allNodes = useMemo(() => [...nodes, ...junctionNodes], [nodes, junctionNodes]);

  // Build edges: marriage lines (spouse) + one shared line per union to children.
  useEffect(() => {
    const next: Edge[] = [];

    // marriage lines — soft bezier, always drawn left→right (husband's right
    // handle → wife's left handle) so the line is a clean short connector and
    // never crosses over. The husband (male) is the left source; if gender can't
    // decide (same-gender / unknown) we fall back to the relocation direction.
    for (const r of relationships) {
      if (r.type !== 'spouse') continue;
      const aMale = genderOf.get(r.aId) === 'male';
      const bMale = genderOf.get(r.bId) === 'male';

      // "Vợ 2" family: the husband (2+ spouses) sits above each wife, so route
      // the marriage line husband-bottom → wife-top for a clean vertical branch.
      const husbandId =
        (spouseCount.get(r.aId) ?? 0) >= 2
          ? r.aId
          : (spouseCount.get(r.bId) ?? 0) >= 2
            ? r.bId
            : null;
      if (husbandId) {
        const wifeId = husbandId === r.aId ? r.bId : r.aId;
        next.push({
          id: r.id,
          source: husbandId,
          target: wifeId,
          sourceHandle: 'bottom',
          targetHandle: 'top',
          type: 'smoothstep',
          pathOptions: { borderRadius: 16 },
          selectable: true,
          style: { stroke: CRIMSON, strokeWidth: 2, strokeDasharray: '5 5' },
        } as Edge);
        continue;
      }

      // Side-by-side couple: husband (male) on the left, line runs left→right.
      let source = r.aId;
      let target = r.bId;
      if (aMale !== bMale) {
        if (bMale) [source, target] = [r.bId, r.aId]; // male on the left
      } else {
        const rel = relocatedPair.get([r.aId, r.bId].sort().join('+'));
        if (rel) [source, target] = [rel.anchor, rel.mover];
      }
      next.push({
        id: r.id,
        source,
        target,
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
      if (isMultiWifeUnion(u.parentIds)) {
        // vợ 2: drop straight from the mother (a clean vertical line under her)
        const mother = motherOf(u.parentIds);
        for (const childId of u.childIds) {
          next.push({
            id: `${u.id}__${childId}`,
            source: mother,
            target: childId,
            sourceHandle: 'bottom',
            targetHandle: 'top',
            type: 'smoothstep',
            pathOptions: { borderRadius: 16 },
            style: childStyle(childId, { stroke: ORANGE, strokeWidth: 2 }),
          } as Edge);
        }
      } else if (isCoupleUnion(u.parentIds)) {
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
  }, [relationships, unions, isCoupleUnion, isMultiWifeUnion, motherOf, moverIds, relocatedPair, genderOf, spouseCount, setEdges]);

  const doLayout = useCallback(() => {
    const positioned =
      layoutMode === 'vertical'
        ? layoutTreeVertical(people, relationships)
        : layoutTree(people, relationships);
    const map = new Map(positioned.map((p) => [p.id, p]));
    setNodes((prev) =>
      prev.map((n) => {
        const pos = map.get(n.id);
        return pos ? { ...n, position: { x: pos.x, y: pos.y } } : n;
      }),
    );
    // Persist the computed arrangement so it survives reloads / other tabs.
    const saved: Record<string, { x: number; y: number }> = {};
    for (const p of positioned) saved[p.id] = { x: p.x, y: p.y };
    setPositions(saved);
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 400 }));
  }, [people, relationships, setNodes, setPositions, fitView, layoutMode]);

  // On first mount keep the saved arrangement (just fit); only auto-layout when
  // there are no saved positions yet. Later layout requests always re-arrange.
  useEffect(() => {
    if (!didInit.current) {
      didInit.current = true;
      if (Object.keys(positions).length > 0) {
        requestAnimationFrame(() => fitView({ padding: 0.2, duration: 400 }));
      } else {
        doLayout();
      }
      return;
    }
    doLayout();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutTick]);

  // Re-center on request (e.g. after a shared tree loads async) without
  // recomputing positions.
  useEffect(() => {
    if (fitTick === 0) return;
    requestAnimationFrame(() => fitView({ padding: 0.2, duration: 400 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitTick]);

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
      if (readOnly) return;
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
    [addRelationship, readOnly],
  );

  const onEdgesDelete = useCallback(
    (deleted: Edge[]) => {
      if (readOnly) return;
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
      });
    },
    [removeRelationship, relationships, readOnly],
  );

  const onNodeClick: NodeMouseHandler = useCallback(
    (_, node) => {
      if (node.type !== 'person') return;
      setSelected(node.id);
      onEdit(node.id);
    },
    [setSelected, onEdit],
  );

  // Persist a node's position after a manual drag so it survives reloads.
  const onNodeDragStop: OnNodeDrag<Node> = useCallback(
    (_, node) => {
      if (node.type !== 'person') return;
      setPosition(node.id, node.position.x, node.position.y);
    },
    [setPosition],
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
      onNodeDragStop={onNodeDragStop}
      onPaneClick={() => setSelected(null)}
      colorMode={dark ? 'dark' : 'light'}
      fitView
      minZoom={0.2}
      nodesConnectable={!readOnly}
      nodesDraggable={!readOnly}
      proOptions={{ hideAttribution: true }}
      defaultEdgeOptions={{ deletable: !readOnly }}
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
