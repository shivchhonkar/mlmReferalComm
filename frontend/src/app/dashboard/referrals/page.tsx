"use client"

import Link from "next/link"
import { useEffect, useMemo, useState, useCallback } from "react"
import { apiFetch } from "@/lib/apiClient"
import {
  Network,
  Users,
  Layers,
  CheckCircle2,
  GitBranch,
  ArrowUpRight,
  ArrowLeft,
  List as ListIcon,
  Share2,
} from "lucide-react"

import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Handle,
  Position as RFPosition,
  type Node as RFNode,
  type Edge as RFEdge,
  type NodeTypes,
  useEdgesState,
  useNodesState,
} from "reactflow"
import "reactflow/dist/style.css"

import dagre from "dagre"

type Position = "left" | "right" | null

type ApiNode = {
  id: string
  name?: string
  email: string
  referralCode: string
  status?: "active" | "suspended" | "deleted"
  activityStatus?: "active" | "inactive"
  position?: Position
  joinedAt?: string
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

type ReferredBy = {
  id: string
  name: string
  mobile?: string
  email?: string
  referralCode?: string
} | null

type ListItem = {
  id: string
  name: string
  email: string
  mobile?: string
  referralCode: string
  status: string
  activityStatus: string
  position: "left" | "right" | null
  joinedAt: string
  level: number
  parentId: string | null
  referredBy?: ReferredBy
}

type ListResponse = {
  total: number
  offset: number
  limit: number
  depth: number
  items: ListItem[]
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-xs  text-zinc-700">
      {children}
    </span>
  )
}

/** ---------------------------
 * React Flow Node UI
 * --------------------------*/
type ReferralNodeData = {
  id: string
  name: string
  email: string
  referralCode: string
  status: string
  position: Position
  level: number
  selected?: boolean
}

function ReferralNode({ data }: { data: ReferralNodeData }) {
  const compact = data.level >= 2
  const isActive = (data.status ?? "active") === "active"

  return (
    <div
      className={[
        "rounded-2xl border bg-white shadow-sm",
        "min-w-[220px] max-w-[260px]",
        data.selected ? "border-emerald-300 ring-2 ring-emerald-200/50" : "border-zinc-200",
      ].join(" ")}
    >
      {/* handles */}
      <Handle type="target" position={RFPosition.Top} style={{ opacity: 0 }} />
      <Handle type="source" position={RFPosition.Bottom} style={{ opacity: 0 }} />

      <div className="p-3">
        <div className="flex items-center gap-2">
          <span className="rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 px-2.5 py-1 text-[11px]  text-white">
            L{data.level}
          </span>

          <span
            className={[
              "rounded-full border px-2 py-0.5 text-[11px] ",
              isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-zinc-50 text-zinc-700",
            ].join(" ")}
          >
            {data.status ?? "active"}
          </span>

          {data.position ? (
            <span className="ml-auto rounded-full border border-sky-200 bg-sky-50 px-2 py-0.5 text-[11px]  text-sky-700">
              {data.position.toUpperCase()}
            </span>
          ) : (
            <span className="ml-auto text-[11px]  text-zinc-400">ROOT</span>
          )}
        </div>

        <div className="mt-2">
          <div className="truncate text-sm  text-zinc-900" title={data.name}>
            {data.name}
          </div>
          {!compact ? (
            <div className="truncate text-[11px] text-zinc-600" title={data.email}>
              {data.email}
            </div>
          ) : null}
        </div>

        <div className="mt-2 flex items-center gap-2">
          <span className="text-[11px] text-zinc-500">Code</span>
          <span className="truncate rounded-lg border border-sky-200 bg-sky-50 px-2 py-0.5 font-mono text-[11px]  text-sky-800">
            {data.referralCode}
          </span>
        </div>

        {!compact ? (
          <div className="mt-2 text-[11px] text-zinc-500">
            Tip: click node to see details
          </div>
        ) : null}
      </div>
    </div>
  )
}

const nodeTypes: NodeTypes = { referralNode: ReferralNode }

/** ---------------------------
 * Tree -> Graph conversion + dagre layout
 * --------------------------*/
const NODE_W = 240
const NODE_H = 110

function safeName(n: ApiNode) {
  return (n.name || n.email || "User").trim()
}

function treeToGraph(root: ApiNode) {
  const nodes: RFNode<ReferralNodeData>[] = []
  const edges: RFEdge[] = []

  const stack: { node: ApiNode; parentId?: string; level: number }[] = [{ node: root, level: 0 }]

  while (stack.length) {
    const { node, parentId, level } = stack.pop()!

    nodes.push({
      id: node.id,
      type: "referralNode",
      position: { x: 0, y: 0 }, // will be set by layout
      data: {
        id: node.id,
        name: safeName(node),
        email: node.email || "",
        referralCode: node.referralCode,
        status: node.status ?? "active",
        position: node.position ?? null,
        level,
      },
    })

    if (parentId) {
      edges.push({
        id: `${parentId}->${node.id}`,
        source: parentId,
        target: node.id,
        animated: false,
        label: node.position ? node.position.toUpperCase() : "",
        style: { strokeWidth: 1.5 },
      })
    }

    for (const c of node.children ?? []) {
      stack.push({ node: c, parentId: node.id, level: level + 1 })
    }
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
    return {
      ...n,
      position: { x: p.x - NODE_W / 2, y: p.y - NODE_H / 2 },
    }
  })

  return { nodes: laidOutNodes, edges }
}

/** ---------------------------
 * Page
 * --------------------------*/
export default function ReferralsPage() {
  const [error, setError] = useState<string | null>(null)

  // View toggle
  const [view, setView] = useState<"tree" | "list">("list")

  // Tree response + selected
  const [data, setData] = useState<ApiResponse | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // ReactFlow state
  const [nodes, setNodes, onNodesChange] = useNodesState<ReferralNodeData>([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  // List data + search
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<"" | "active" | "suspended">("")
  const [list, setList] = useState<ListResponse | null>(null)
  const [listBusy, setListBusy] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 50

  // collapsible "Referred By" per row
  const [openReferredBy, setOpenReferredBy] = useState<Record<string, boolean>>({})
  const toggleReferredBy = (id: string) => setOpenReferredBy((p) => ({ ...p, [id]: !p[id] }))

  // Load tree once
  useEffect(() => {
    apiFetch("/api/referrals?depth=10")
      .then(async (r) => {
        const json = (await r.json()) as ApiResponse
        if (!r.ok) throw new Error((json as any)?.error ?? "Failed to load")
        setData(json)

        if (json.root) {
          setSelectedId(json.root.id)
          const { nodes: rawNodes, edges: rawEdges } = treeToGraph(json.root)
          const laid = layoutWithDagre(rawNodes, rawEdges)
          setNodes(laid.nodes)
          setEdges(laid.edges)
        }
      })
      .catch((e) => setError(String(e?.message ?? e)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // When selection changes, mark node selected (for highlight)
  useEffect(() => {
    setNodes((prev) =>
      prev.map((n) => ({
        ...n,
        data: { ...(n.data as any), selected: selectedId === n.id },
      }))
    )
  }, [selectedId, setNodes])

  // reset pagination when search changes
  useEffect(() => setOffset(0), [q, status, view])

  // List fetch (debounced)
  useEffect(() => {
    if (view !== "list") return

    const t = window.setTimeout(async () => {
      setListBusy(true)
      setError(null)
      try {
        const qs = new URLSearchParams({
          depth: "20",
          limit: String(limit),
          offset: String(offset),
        })
        if (q.trim()) qs.set("q", q.trim())
        if (status) qs.set("status", status)

        const r = await apiFetch(`/api/referrals/list?${qs.toString()}`)
        const text = await r.text()

        let json: any = null
        try {
          json = text ? JSON.parse(text) : null
        } catch {
          // not json
        }

        if (!r.ok) throw new Error(json?.error ?? `List API failed (${r.status}). ${text.slice(0, 120)}...`)
        if (!json) throw new Error(`List API returned non-JSON. ${text.slice(0, 120)}...`)

        setList(json)
      } catch (e: any) {
        setError(String(e?.message ?? e))
      } finally {
        setListBusy(false)
      }
    }, 350)

    return () => window.clearTimeout(t)
  }, [view, q, status, offset])

  const stats = data?.stats ?? null

  const selectedNode = useMemo(() => {
    if (!selectedId) return null
    const n = nodes.find((x) => x.id === selectedId)
    return n?.data ?? null
  }, [selectedId, nodes])

  const breadcrumb = useMemo(() => {
    // Build path by walking incoming edges to root
    if (!selectedId) return []
    const parentByChild = new Map<string, string>()
    edges.forEach((e) => parentByChild.set(e.target, e.source))
    const path: ReferralNodeData[] = []
    let cur: string | undefined = selectedId
    let guard = 0
    while (cur && guard < 50) {
      const n = nodes.find((x) => x.id === cur)?.data
      if (n) path.push(n)
      cur = parentByChild.get(cur)
      guard++
    }
    return path.reverse()
  }, [selectedId, nodes, edges])

  const canPrev = offset > 0
  const canNext = list ? offset + limit < list.total : false

  const onNodeClick = useCallback(
    (_: any, node: RFNode) => {
      setSelectedId(node.id)
    },
    [setSelectedId]
  )

  return (
    <div className="min-h-screen bg-white">
      <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {/* <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-sky-600 text-white">
                <Network className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-zinc-800">Referral Network</span>
            </div> */}

            <h1 className="mt-4 text-3xl tracking-tight text-zinc-900 sm:text-4xl text-wrap inline-flex items-center gap-3">
              <Network className="h-4 w-4" /> Referral Network
            </h1>
            {/* <p className="mt-2 text-sm text-zinc-600">
              React Flow Tree (zoom/pan/minimap) + List View (search + pagination).
            </p> */}
          </div>

          <Link
            className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm  text-zinc-800 shadow-sm transition hover:bg-zinc-50"
            prefetch={false}
            href="/dashboard"
          >
            ← Back to Dashboard
          </Link>
        </div>

        {/* Toggle + search */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* <div className="flex gap-2"> */}
            {/* <button
              type="button"
              onClick={() => setView("list")}
              className={[
                "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm  shadow-sm",
                view === "list"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
              ].join(" ")}
            >
              <ListIcon className="h-4 w-4" />
              List View
            </button> */}
             {/* <button
              type="button"
              onClick={() => setView("tree")}
              className={[
                "inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm  shadow-sm",
                view === "tree"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                  : "border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50",
              ].join(" ")}
            >
              <GitBranch className="h-4 w-4" />
              Tree View
            </button> */}
          {/* </div> */}

          {view === "list" ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search email / code / name…"
                className="w-full sm:w-80 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
              />

              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm"
              >
                <option value="">All Status</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          ) : null}
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-white p-4 text-sm font-semibold text-red-700 shadow-sm">
            ⚠️ {error}
          </div>
        ) : null}

        {/* Stats */}
        {stats ? (
          <div className="mb-6 rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center gap-3">
              <Badge>
                <GitBranch className="mr-2 h-4 w-4" /> Direct: {stats.directCount ?? stats.directLeft + stats.directRight}
              </Badge>
              <Badge>
                <Users className="mr-2 h-4 w-4" /> Team: {stats.total}
              </Badge>
              <Badge>
                <CheckCircle2 className="mr-2 h-4 w-4" /> Active: {stats.active}
              </Badge>
              <Badge>
                <Layers className="mr-2 h-4 w-4" /> Depth: {stats.depth}
              </Badge>
            </div>
            <p className="mt-2 text-xs text-zinc-600">
              Tip: In Tree View, zoom/pan for clarity. Click a node to see details.
            </p>
          </div>
        ) : null}

        {/* CONTENT */}
        {view === "tree" ? (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* ReactFlow canvas */}
            <div className="lg:col-span-2 rounded-3xl border border-zinc-200 bg-white p-3 shadow-sm">
              <div className="h-[70vh] min-h-[520px] w-full overflow-hidden rounded-2xl">
                <ReactFlow
                  nodes={nodes}
                  edges={edges}
                  onNodesChange={onNodesChange}
                  onEdgesChange={onEdgesChange}
                  onNodeClick={onNodeClick}
                  nodeTypes={nodeTypes}
                  fitView
                  fitViewOptions={{ padding: 0.2 }}
                  defaultViewport={{ x: 0, y: 0, zoom: 0.9 }}
                  proOptions={{ hideAttribution: true }}
                >
                  <Background />
                  <Controls />
                  <MiniMap zoomable pannable />

                  {/* small legend */}
                  <div className="absolute left-3 top-3 z-10 rounded-2xl border border-zinc-200 bg-white/90 px-3 py-2 text-xs text-zinc-700 shadow-sm backdrop-blur">
                    <div className=" text-zinc-900">Tips</div>
                    <div>• Scroll to zoom</div>
                    <div>• Drag to pan</div>
                    <div>• Click node for details</div>
                  </div>
                </ReactFlow>
              </div>
            </div>

            {/* Details panel */}
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              <div className="mb-3 text-sm  text-zinc-900">Selected</div>

              {breadcrumb.length ? (
                <div className="mb-4">
                  <div className="text-xs  text-zinc-700">Path</div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {breadcrumb.map((n, idx) => (
                      <button
                        key={n.id}
                        type="button"
                        onClick={() => setSelectedId(n.id)}
                        className={[
                          "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs  transition",
                          idx === breadcrumb.length - 1
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-zinc-200 bg-zinc-50 text-zinc-700 hover:bg-zinc-100",
                        ].join(" ")}
                        title={n.email}
                      >
                        <ArrowUpRight className="h-3 w-3" />
                        {n.name}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {selectedNode ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-sm  text-zinc-900">{selectedNode.name}</div>
                    <div className="mt-1 text-xs text-zinc-600">{selectedNode.email}</div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs  text-emerald-700">
                        {selectedNode.status ?? "active"}
                      </span>
                      {selectedNode.position ? (
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs  text-sky-700">
                          {selectedNode.position.toUpperCase()}
                        </span>
                      ) : (
                        <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs  text-zinc-700">
                          ROOT
                        </span>
                      )}
                      <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs  text-zinc-700">
                        L{selectedNode.level}
                      </span>
                    </div>

                    <div className="mt-3">
                      <div className="text-xs text-zinc-600">Referral code</div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <code className="font-mono text-sm  text-emerald-700">
                          {selectedNode.referralCode}
                        </code>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(selectedNode.referralCode)}
                          className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs  text-emerald-800 hover:bg-emerald-50 hover:cursor-pointer"
                        >
                          Copy
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-xs text-zinc-600">
                    <b>Professional view:</b> React Flow avoids “card stacking” issues by enabling zoom/pan.
                  </div>
                </div>
              ) : (
                <div className="text-sm text-zinc-600">Click any node to see details.</div>
              )}
            </div>
          </div>
        ) : (
          /* LIST VIEW */
          <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm  text-zinc-900">
                Downline List {list ? <span className="text-zinc-500">({list.total})</span> : null}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setOffset((o) => Math.max(o - limit, 0))}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs  text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                  disabled={!canPrev || listBusy}
                >
                  Prev
                </button>
                <button
                  type="button"
                  onClick={() => setOffset((o) => o + limit)}
                  className="rounded-xl border border-zinc-200 bg-white px-3 py-1.5 text-xs  text-zinc-800 hover:bg-zinc-50 disabled:opacity-50"
                  disabled={!canNext || listBusy}
                >
                  Next
                </button>
              </div>
            </div>

            <div className="overflow-auto rounded-2xl border border-zinc-200">
              <table className="w-full text-sm">
                <thead className="bg-gradient-to-r from-emerald-50 to-sky-50 text-left text-zinc-700">
                  <tr>
                    <th className="py-3 px-4 ">Level</th>
                    <th className="py-3 px-4 ">User</th>
                    <th className="py-3 px-4 ">Code</th>
                    {/* <th className="py-3 px-4 ">Position</th> */}
                    <th className="py-3 px-4 ">Status</th>
                    <th className="py-3 px-4 ">Joined</th>
                    <th className="py-3 px-4 ">Action</th>
                  </tr>
                </thead>

                <tbody>
                  {(list?.items ?? []).map((u) => {
                    const isOpen = !!openReferredBy[u.id]
                    const rb = u.referredBy ?? null

                    return (
                      <tr key={u.id} className="border-t border-zinc-200 hover:bg-emerald-50/40 transition-colors">
                        <td className="py-3 px-4 align-top">
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs  text-emerald-700">
                            L{u.level}
                          </span>
                        </td>

                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-zinc-900">{u.name}</div>
                          <div className="text-xs text-zinc-600">Mobile: {u.mobile},  {u.email}</div>
                          <div className="text-xs text-zinc-600">Code: {u.referralCode}</div>

                         
                        </td>

                        <td className="py-3 px-4 font-mono text-xs  text-sky-800 align-top"> {/* Referred by (collapsible) */}
                          {rb ? (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => toggleReferredBy(u.id)}
                                className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px]  text-sky-800 hover:bg-sky-100"
                                title="Show / hide referred by"
                              >
                                <span className="text-sky-700">Ref by:</span>
                                <span className="max-w-[180px] truncate">{rb.name}</span>
                                <span className="ml-1 text-sky-700 hover:cursor-pointer">{isOpen ? "▲" : "▼"}</span>
                              </button>

                              {isOpen ? (
                                <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-3 text-[11px] text-zinc-700 shadow-sm">
                                  <div className=" text-zinc-900">{rb.name}</div>
                                  <div className="mt-0.5 text-zinc-600">{rb.mobile}, {rb.email || "—"}</div>

                                  {rb.referralCode ? (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <span className="text-zinc-600">Code:</span>
                                      <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px]  text-emerald-800">
                                        {rb.referralCode}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => navigator.clipboard.writeText(rb.referralCode || "")}
                                        className="rounded-lg border border-emerald-200 bg-white px-2 py-0.5 text-[11px]  text-emerald-800 hover:bg-emerald-50 hover:cursor-pointer"
                                      >
                                        Copy
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <div className="mt-2 inline-flex items-center rounded-xl border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px]  text-zinc-600">
                              Referred by: —
                            </div>
                          )}</td>

                        {/* <td className="py-3 px-4 align-top"> */}
                          {/* {u.position ? (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs  text-sky-700">
                              {u.position.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )} */}
                        {/* </td> */}

                        <td className="py-3 px-4 align-top">
                          <span
                            className={[
                              "rounded-full border px-2 py-1 text-xs ",
                              u.status === "active"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-zinc-200 bg-zinc-50 text-zinc-700",
                            ].join(" ")}
                          >
                            {u.status}
                          </span>
                        </td>

                        <td className="py-3 px-4 text-xs text-zinc-700 align-top">{new Date(u.joinedAt).toLocaleString()}</td>

                        <td className="py-3 px-4 align-top">
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(u.referralCode)}
                            className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs  text-emerald-800 hover:bg-emerald-50 hover:cursor-pointer"
                            title="Copy code"
                          >
                            <Share2 className="h-3 w-3" />
                            Copy
                          </button>
                        </td>
                      </tr>
                    )
                  })}

                  {listBusy ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-600">
                        Loading…
                      </td>
                    </tr>
                  ) : null}

                  {!listBusy && (list?.items?.length ?? 0) === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-600">
                        No results found.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {list ? (
              <div className="mt-3 text-xs text-zinc-600">
                Showing <b>{list.total === 0 ? 0 : offset + 1}</b> – <b>{Math.min(offset + limit, list.total)}</b> of{" "}
                <b>{list.total}</b>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}
