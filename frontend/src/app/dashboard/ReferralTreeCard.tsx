"use client"

import React, { useCallback, useEffect, useMemo, useState } from "react"
import { apiFetch } from "@/lib/apiClient"

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeTypes,
  Handle,
  Position as RFPosition,
  useEdgesState,
  useNodesState,
} from "reactflow"
import "reactflow/dist/style.css"

import dagre from "dagre"

type ApiNode = {
  id: string
  name?: string
  fullName?: string
  email: string
  referralCode: string
  status?: "active" | "suspended" | "deleted"
  activityStatus?: "active" | "inactive"
  position?: "left" | "right" | null
  joinedAt?: string
  createdAt?: string
  children: ApiNode[]
}

type ApiResponse = {
  root: ApiNode | null
  stats: {
    directCount: number
    directLeft: number
    directRight: number
    total: number
    active: number
    depth: number
  } | null
}

export type ReferralNode = {
  id: string
  name: string
  email: string
  referralCode: string
  joinedAt: string
  status: "active" | "inactive" // we map: suspended/deleted => inactive
  level: number
  totalBV: number
  children: ReferralNode[]
}

function computeStats(root: ReferralNode | null) {
  if (!root) return { direct: 0, total: 0, active: 0, maxDepth: 0 }
  let total = 0
  let active = 0
  let maxDepth = 0
  const dfs = (n: ReferralNode) => {
    maxDepth = Math.max(maxDepth, n.level)
    for (const c of n.children) {
      total += 1
      if (c.status === "active") active += 1
      dfs(c)
    }
  }
  dfs(root)
  return { direct: root.children.length, total, active, maxDepth }
}

function toAppNode(api: ApiNode, level: number): ReferralNode {
  const name = (api.name || api.fullName || api.email || "User").trim()
  const joinedAt = api.joinedAt || api.createdAt || new Date().toISOString()
  const status: "active" | "inactive" = api.status === "active" ? "active" : "inactive"

  return {
    id: api.id,
    name,
    email: api.email || "",
    referralCode: api.referralCode || "",
    joinedAt,
    status,
    level,
    totalBV: 0, // not coming from API; keep 0 or enrich later
    children: (api.children || []).map((c) => toAppNode(c, level + 1)),
  }
}

/** --------------------------
 * Build lookup maps for focus mode + search
 * -------------------------- */
type Maps = {
  byId: Record<string, ReferralNode>
  parentById: Record<string, string | null>
}

function buildMaps(root: ReferralNode | null): Maps {
  const byId: Record<string, ReferralNode> = {}
  const parentById: Record<string, string | null> = {}

  if (!root) return { byId, parentById }

  const stack: { n: ReferralNode; parent: string | null }[] = [{ n: root, parent: null }]
  while (stack.length) {
    const { n, parent } = stack.pop()!
    byId[n.id] = n
    parentById[n.id] = parent
    for (const c of n.children) stack.push({ n: c, parent: n.id })
  }

  return { byId, parentById }
}

/** --------------------------
 * ReactFlow Node
 * -------------------------- */
type FlowNodeData = {
  id: string
  name: string
  email: string
  referralCode: string
  status: "active" | "inactive"
  level: number
  selected: boolean
}

function FlowCard({ data }: { data: FlowNodeData }) {
  const compact = data.level >= 2
  return (
    <div
      className={[
        "rounded-2xl border bg-white shadow-sm",
        "min-w-[220px] max-w-[260px]",
        data.selected ? "border-emerald-300 ring-2 ring-emerald-200/50" : "border-zinc-200",
      ].join(" ")}
    >
      <Handle type="target" position={RFPosition.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={RFPosition.Bottom} style={{ opacity: 0 }} />

      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 px-2.5 py-1 text-[11px]  text-white">
            L - {data.level}
          </span>

          <span
            className={[
              "rounded-full border px-2 py-0.5 text-[11px] ",
              data.status === "active"
                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                : "border-zinc-200 bg-zinc-50 text-zinc-600",
            ].join(" ")}
          >
            {data.status}
          </span>
        </div>

        <div className="mt-2">
          <div className="truncate text-xs text-zinc-900" title={data.name}>
            {data.name}
          </div>
          {!compact ? (
            <div className="truncate text-[10px] text-zinc-600" title={data.email}>
              {data.email}
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-[10px] text-zinc-500">Code</span>
          <span className="truncate rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[11px]  text-sky-800">
            {data.referralCode}
          </span>
        </div>

        {!compact ? (
          <div className="mt-2 text-[11px] text-zinc-500">Click node to select</div>
        ) : null}
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = { flowCard: FlowCard }

/** --------------------------
 * Tree -> graph + dagre layout
 * -------------------------- */
const NODE_W = 240
const NODE_H = 110

function buildGraphFromTree(root: ReferralNode) {
  const nodes: RFNode<FlowNodeData>[] = []
  const edges: RFEdge[] = []

  const stack: { n: ReferralNode; parentId?: string }[] = [{ n: root }]

  while (stack.length) {
    const { n, parentId } = stack.pop()!

    nodes.push({
      id: n.id,
      type: "flowCard",
      position: { x: 0, y: 0 },
      data: {
        id: n.id,
        name: n.name,
        email: n.email,
        referralCode: n.referralCode,
        status: n.status,
        level: n.level,
        selected: false,
      },
    })

    if (parentId) {
      edges.push({
        id: `${parentId}->${n.id}`,
        source: parentId,
        target: n.id,
        style: { strokeWidth: 1.5 },
      })
    }

    for (const c of n.children) stack.push({ n: c, parentId: n.id })
  }

  return { nodes, edges }
}

function layoutWithDagre(nodes: RFNode[], edges: RFEdge[]) {
  const g = new dagre.graphlib.Graph()
  g.setDefaultEdgeLabel(() => ({}))
  g.setGraph({
    rankdir: "TB",
    nodesep: 40,
    ranksep: 90,
    marginx: 20,
    marginy: 20,
  })

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }))
  edges.forEach((e) => g.setEdge(e.source, e.target))

  dagre.layout(g)

  const laidOutNodes = nodes.map((n) => {
    const p = g.node(n.id)
    return { ...n, position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 } }
  })

  return { nodes: laidOutNodes, edges }
}

/** --------------------------
 * Focus Mode:
 * Parent + Selected + Children
 * -------------------------- */
function buildFocusTree(root: ReferralNode, maps: Maps, selectedId: string): ReferralNode {
  const selected = maps.byId[selectedId] || root
  const parentId = maps.parentById[selected.id]
  const parent = parentId ? maps.byId[parentId] : null

  // Clone selected (keep only its children)
  const selectedClone: ReferralNode = {
    ...selected,
    children: selected.children.map((c) => ({ ...c, children: [] })), // keep immediate children only
  }

  if (!parent) {
    // Root selected
    return { ...selectedClone, level: 0 }
  }

  // Build a tiny tree: parent -> selected -> children
  // Put parent as level 0, selected as level 1, children as level 2
  const parentClone: ReferralNode = {
    ...parent,
    level: 0,
    children: [
      {
        ...selectedClone,
        level: 1,
        children: selectedClone.children.map((c) => ({ ...c, level: 2 })),
      },
    ],
  }

  return parentClone
}

/** --------------------------
 * Component
 * -------------------------- */
export default function ReferralTreeCard({
  onOpenFullTree,
}: {
  tree?: ReferralNode | null // ignored now (data comes from API)
  onOpenFullTree?: () => void
}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [tree, setTree] = useState<ReferralNode | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [focusMode, setFocusMode] = useState(true)

  const stats = useMemo(() => computeStats(tree), [tree])
  const maps = useMemo(() => buildMaps(tree), [tree])

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState<FlowNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // Load from API
  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        setError(null)
        const r = await apiFetch("/api/referrals?depth=10")
        const json = (await r.json()) as ApiResponse
        if (!r.ok) throw new Error((json as any)?.error ?? "Failed to load referrals")

        const root = json.root
        if (!root) {
          if (!mounted) return
          setTree(null)
          setSelectedId(null)
          setNodes([])
          setEdges([])
          return
        }

        const appTree = toAppNode(root, 0)
        if (!mounted) return
        setTree(appTree)
        setSelectedId(appTree.id)
      } catch (e: any) {
        if (!mounted) return
        setError(String(e?.message ?? e))
      } finally {
        if (!mounted) return
        setLoading(false)
      }
    })()

    return () => {
      mounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Build graph whenever tree / focusMode / selectedId changes
  useEffect(() => {
    if (!tree) return

    const sel = selectedId || tree.id
    const baseTree = focusMode ? buildFocusTree(tree, maps, sel) : tree

    const { nodes: rawNodes, edges: rawEdges } = buildGraphFromTree(baseTree)
    const laid = layoutWithDagre(rawNodes, rawEdges)

    // set selection highlight
    const selected = sel
    const nextNodes = laid.nodes.map((n) => ({
      ...n,
      data: { ...(n.data as any), selected: n.id === selected },
    }))

    setNodes(nextNodes as any)
    setEdges(laid.edges as any)
  }, [tree, focusMode, selectedId, maps, setNodes, setEdges])

  // click node select
  const onNodeClick = useCallback((_: any, node: RFNode) => {
    setSelectedId(node.id)
  }, [])

  // Search: focus first match
  const searchMatchId = useMemo(() => {
    if (!tree || !query.trim()) return null
    const q = query.trim().toLowerCase()
    const byId = maps.byId
    for (const id of Object.keys(byId)) {
      const n = byId[id]
      if (
        n.name.toLowerCase().includes(q) ||
        n.email.toLowerCase().includes(q) ||
        n.referralCode.toLowerCase().includes(q)
      ) {
        return id
      }
    }
    return null
  }, [tree, query, maps])

  useEffect(() => {
    if (searchMatchId) setSelectedId(searchMatchId)
  }, [searchMatchId])

  const selected = useMemo(() => {
    if (!tree || !selectedId) return null
    return maps.byId[selectedId] || null
  }, [tree, selectedId, maps])

  return (
    <div className="mt-6 rounded-3xl border border-emerald-200 bg-white p-6 shadow-sm transition hover:shadow-md">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-lg  text-zinc-900">Referrals</h2>
          <p className="text-xs text-zinc-600">Professional graph view (zoom/pan) + Focus Mode for readability.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700">
            Direct: <b>{stats.direct}</b>
          </span>
          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs text-zinc-700">
            Total Team: <b>{stats.total}</b>
          </span>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs text-emerald-700">
            Active: <b>{stats.active}</b>
          </span>
          <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700">
            Depth: <b>{stats.maxDepth}</b>
          </span>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-white p-3 text-sm font-semibold text-red-700">
          ⚠️ {error}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Graph */}
        <div className="lg:col-span-2">
          <div className="mb-3 flex flex-col-2 gap-2 sm:flex-row sm:items-center sm:justify-between">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name / email / code…"
              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
            />

            
              <button
                type="button"
                onClick={() => setFocusMode((v) => !v)}
                className={[
                  "rounded-2xl min-w-[200px] border px-4 py-2.5 text-sm  shadow-sm transition",
                  focusMode
                    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                    : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
                ].join(" ")}
                title="Focus Mode shows Parent + Selected + Children only"
              >
                {focusMode ? "Focus Mode: ON" : "Focus Mode: OFF"}
              </button>

              {onOpenFullTree ? (
                <button
                  type="button"
                  onClick={onOpenFullTree}
                  className="whitespace-nowrap rounded-2xl border border-emerald-200 bg-white px-4 py-2.5 text-sm  text-emerald-800 shadow-sm transition hover:bg-emerald-50"
                >
                  Full Tree →
                </button>
              ) : null}
          </div>

          <div className="h-[520px] overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {loading ? (
              <div className="p-6 text-sm text-zinc-600">Loading referrals…</div>
            ) : !tree ? (
              <div className="p-6 text-sm text-zinc-600">No referrals yet.</div>
            ) : (
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onNodeClick={onNodeClick}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.2 }}
                defaultViewport={{ x: 0, y: 0, zoom: 0.1 }}
                proOptions={{ hideAttribution: true }}
              >
                {/* <Background /> */}
                <Controls />
                {/* <MiniMap zoomable pannable /> */}
              </ReactFlow>
            )}
          </div>

          <div className="mt-2 text-xs text-zinc-600">
            Tip: Scroll to zoom, drag to pan. Search selects the first match. Focus Mode keeps the view clean.
          </div>
        </div>

        {/* Details */}
        <div className="rounded-2xl border border-zinc-200 bg-gradient-to-b from-zinc-50 to-white p-4">
          <div className="text-sm  text-zinc-900">Selected</div>

          {selected ? (
            <div className="mt-3 space-y-2">
              <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                <div className=" text-zinc-900">{selected.name}</div>
                <div className="text-xs text-zinc-600">{selected.email}</div>

                <div className="mt-2 flex flex-wrap gap-2">
                  <span
                    className={[
                      "rounded-full border px-2 py-0.5 text-xs",
                      selected.status === "active"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-zinc-200 bg-zinc-50 text-zinc-600",
                    ].join(" ")}
                  >
                    {selected.status}
                  </span>

                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700">
                    L{selected.level}
                  </span>

                  <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-xs text-sky-700">
                    BV {selected.totalBV}
                  </span>

                  <span className="rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-xs text-zinc-700">
                    Team {selected.children.length}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-3">
                <div className="text-xs text-zinc-600">Referral code</div>
                <div className="mt-1 flex items-center justify-between gap-2">
                  <code className=" text-emerald-700">{selected.referralCode}</code>
                  <button
                    type="button"
                    className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs  text-emerald-800 hover:bg-emerald-50"
                    onClick={() => navigator.clipboard.writeText(selected.referralCode)}
                  >
                    Copy
                  </button>
                </div>

                <div className="mt-2 text-xs text-zinc-600">
                  Joined: {new Date(selected.joinedAt).toLocaleString()}
                </div>
              </div>

              <div className="rounded-2xl border border-zinc-200 bg-white p-3 text-xs text-zinc-700">
                <b>Focus Mode:</b> shows parent + selected + children (best for large trees).
              </div>
            </div>
          ) : (
            <div className="mt-2 text-sm text-zinc-600">Click any node to view details.</div>
          )}
        </div>
      </div>
    </div>
  )
}
