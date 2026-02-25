"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { apiFetch } from "@/lib/apiClient"
import {
  ChevronDown,
  ChevronRight,
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
    directLeft: number
    directRight: number
    total: number
    active: number
    depth: number
  } | null
}

type Node = {
  id: string
  name?: string
  email: string
  referralCode: string
  status?: string
  activityStatus?: string
  position: Position
  joinedAt?: string
}

type Children = { left?: string; right?: string }
type NodeMap = Record<string, Node>
type ChildrenMap = Record<string, Children>
type ParentMap = Record<string, string | undefined>
type LoadedChildrenMap = Record<string, boolean>

type ReferredBy = {
  id: string
  name: string
  email?: string
  mobile?: string
  referralCode?: string
} | null

type ListItem = {
  id: string
  name: string
  email: string
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

function EmptySlot({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-center">
      <div className="text-sm  text-zinc-700">{label}</div>
      <div className="mt-1 text-xs text-zinc-600">No user in this position yet</div>
    </div>
  )
}

function normalizeApiNode(n: ApiNode): Node {
  return {
    id: n.id,
    name: n.name,
    email: n.email,
    referralCode: n.referralCode,
    status: n.status,
    activityStatus: n.activityStatus,
    position: (n.position ?? null) as Position,
    joinedAt: n.joinedAt,
  }
}

/**
 * Flattens nested API tree into maps (O(n)).
 */
function flattenTree(root: ApiNode) {
  const nodesById: NodeMap = {}
  const childrenById: ChildrenMap = {}
  const parentById: ParentMap = {}
  const loadedChildren: LoadedChildrenMap = {}

  const stack: { node: ApiNode; parentId?: string }[] = [{ node: root }]

  while (stack.length) {
    const { node, parentId } = stack.pop()!

    nodesById[node.id] = normalizeApiNode(node)
    if (parentId) parentById[node.id] = parentId

    const left = node.children?.find((c) => c.position === "left")?.id
    const right = node.children?.find((c) => c.position === "right")?.id
    childrenById[node.id] = { left, right }

    loadedChildren[node.id] = true

    for (const c of node.children ?? []) {
      stack.push({ node: c, parentId: node.id })
    }
  }

  return { nodesById, childrenById, parentById, loadedChildren }
}

function NodeCard({
  node,
  level,
  expanded,
  canExpand,
  loading,
  onToggle,
  onSelect,
  selected,
}: {
  node: Node
  level: number
  expanded: boolean
  canExpand: boolean
  loading: boolean
  selected: boolean
  onToggle: () => void
  onSelect: () => void
}) {
  const isActive = (node.status ?? "active") === "active"

  return (
    <div
      className={[
        "rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md",
        selected ? "border-emerald-300" : "border-zinc-200",
      ].join(" ")}
    >
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 px-3 py-1 text-xs  text-white shadow"
          title="Select node"
        >
          L{level}
        </button>

        <span
          className={[
            "rounded-full border px-2.5 py-1 text-xs ",
            isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-zinc-200 bg-zinc-50 text-zinc-700",
          ].join(" ")}
        >
          {node.status ?? "active"}
        </span>

        {node.position ? (
          <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs  text-sky-700">
            {node.position.toUpperCase()}
          </span>
        ) : null}

        {canExpand ? (
          <button
            onClick={onToggle}
            type="button"
            className="ml-auto inline-flex items-center gap-1 rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs  text-zinc-700 transition hover:bg-zinc-100 disabled:opacity-60"
            disabled={loading}
            title="Expand / Collapse"
          >
            {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
            {loading ? "Loading…" : expanded ? "Collapse" : "Expand"}
          </button>
        ) : null}
      </div>

      <div className="mt-3 min-w-0">
        <div className="truncate text-sm  text-zinc-900">{node.name || node.email}</div>
        <div className="truncate text-xs text-zinc-600">{node.email}</div>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className="text-xs text-zinc-600">Code:</span>
          <span className="rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1 font-mono text-xs  text-sky-800">
            {node.referralCode}
          </span>
          <button
            type="button"
            onClick={() => navigator.clipboard.writeText(node.referralCode)}
            className="rounded-xl border border-emerald-200 bg-white px-2.5 py-1 text-xs  text-emerald-800 hover:bg-emerald-50"
          >
            Copy
          </button>
        </div>

        {node.joinedAt ? (
          <div className="mt-2 text-xs text-zinc-600">Joined: {new Date(node.joinedAt).toLocaleString()}</div>
        ) : null}
      </div>
    </div>
  )
}

/**
 * Recursive renderer, but only shows expanded nodes.
 */
function BinaryTree({
  nodeId,
  level,
  nodesById,
  childrenById,
  expandedSet,
  loadingSet,
  loadedChildren,
  onToggleExpand,
  onSelect,
  selectedId,
  maxRenderDepth,
}: {
  nodeId: string
  level: number
  nodesById: NodeMap
  childrenById: ChildrenMap
  expandedSet: Set<string>
  loadingSet: Set<string>
  loadedChildren: LoadedChildrenMap
  onToggleExpand: (id: string) => void
  onSelect: (id: string) => void
  selectedId: string | null
  maxRenderDepth: number
}) {
  const node = nodesById[nodeId]
  if (!node) return null

  const expanded = expandedSet.has(nodeId)
  const loading = loadingSet.has(nodeId)

  const children = childrenById[nodeId] ?? {}
  const leftId = children.left
  const rightId = children.right

  const canExpand = level < maxRenderDepth

  return (
    <div className="space-y-4">
      <NodeCard
        node={node}
        level={level}
        expanded={expanded}
        canExpand={canExpand}
        loading={loading}
        selected={selectedId === nodeId}
        onSelect={() => onSelect(nodeId)}
        onToggle={() => onToggleExpand(nodeId)}
      />

      {expanded && level < maxRenderDepth ? (
        <div className="relative">
          <div className="mx-auto h-6 w-px bg-zinc-200" />

          <div className="grid gap-4 md:grid-cols-2">
            {/* LEFT */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-zinc-200" />
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs  text-zinc-700">
                  LEFT
                </span>
                <span className="h-px flex-1 bg-zinc-200" />
              </div>

              {leftId ? (
                <BinaryTree
                  nodeId={leftId}
                  level={level + 1}
                  nodesById={nodesById}
                  childrenById={childrenById}
                  expandedSet={expandedSet}
                  loadingSet={loadingSet}
                  loadedChildren={loadedChildren}
                  onToggleExpand={onToggleExpand}
                  onSelect={onSelect}
                  selectedId={selectedId}
                  maxRenderDepth={maxRenderDepth}
                />
              ) : loadedChildren[nodeId] ? (
                <EmptySlot label="Left slot" />
              ) : (
                <EmptySlot label="Left slot (expand to load)" />
              )}
            </div>

            {/* RIGHT */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="h-px flex-1 bg-zinc-200" />
                <span className="rounded-full border border-zinc-200 bg-white px-3 py-1 text-xs  text-zinc-700">
                  RIGHT
                </span>
                <span className="h-px flex-1 bg-zinc-200" />
              </div>

              {rightId ? (
                <BinaryTree
                  nodeId={rightId}
                  level={level + 1}
                  nodesById={nodesById}
                  childrenById={childrenById}
                  expandedSet={expandedSet}
                  loadingSet={loadingSet}
                  loadedChildren={loadedChildren}
                  onToggleExpand={onToggleExpand}
                  onSelect={onSelect}
                  selectedId={selectedId}
                  maxRenderDepth={maxRenderDepth}
                />
              ) : loadedChildren[nodeId] ? (
                <EmptySlot label="Right slot" />
              ) : (
                <EmptySlot label="Right slot (expand to load)" />
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default function ReferralsPage() {
  const [error, setError] = useState<string | null>(null)

  // View toggle
  const [view, setView] = useState<"tree" | "list">("tree")

  // Tree data
  const [data, setData] = useState<ApiResponse | null>(null)
  const [rootId, setRootId] = useState<string | null>(null)

  const [nodesById, setNodesById] = useState<NodeMap>({})
  const [childrenById, setChildrenById] = useState<ChildrenMap>({})
  const [parentById, setParentById] = useState<ParentMap>({})
  const [loadedChildren, setLoadedChildren] = useState<LoadedChildrenMap>({})
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set())
  const [loadingSet, setLoadingSet] = useState<Set<string>>(new Set())
  const [selectedId, setSelectedId] = useState<string | null>(null)

  // List data + search
  const [q, setQ] = useState("")
  const [status, setStatus] = useState<"" | "active" | "suspended">("")
  const [list, setList] = useState<ListResponse | null>(null)
  const [listBusy, setListBusy] = useState(false)
  const [offset, setOffset] = useState(0)
  const limit = 50

  // ✅ NEW: collapsible "Referred By" per row
  const [openReferredBy, setOpenReferredBy] = useState<Record<string, boolean>>({})

  const toggleReferredBy = (id: string) => {
    setOpenReferredBy((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  // safety cap
  const maxRenderDepth = 10

  useEffect(() => {
    apiFetch("/api/referrals?depth=5")
      .then(async (r) => {
        const json = (await r.json()) as ApiResponse
        if (!r.ok) throw new Error((json as any)?.error ?? "Failed to load")
        setData(json)

        if (json.root) {
          const flat = flattenTree(json.root)
          setRootId(json.root.id)
          setSelectedId(json.root.id)
          setNodesById(flat.nodesById)
          setChildrenById(flat.childrenById)
          setParentById(flat.parentById)
          setLoadedChildren(flat.loadedChildren)
          setExpandedSet(new Set([json.root.id])) // auto expand root
        }
      })
      .catch((e) => setError(String(e?.message ?? e)))
  }, [])

  // reset pagination when search changes
  useEffect(() => {
    setOffset(0)
  }, [q, status, view])

  // list fetch with debounce
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
          // Not JSON (likely HTML)
        }

        if (!r.ok) {
          throw new Error(json?.error ?? `List API failed (${r.status}). Response: ${text.slice(0, 120)}...`)
        }

        if (!json) {
          throw new Error(`List API returned non-JSON. First chars: ${text.slice(0, 120)}...`)
        }

        setList(json)
      } catch (e: any) {
        setError(String(e?.message ?? e))
      } finally {
        setListBusy(false)
      }
    }, 350)

    return () => window.clearTimeout(t)
  }, [view, q, status, offset])

  async function ensureChildrenLoaded(nodeId: string) {
    if (loadedChildren[nodeId]) return

    setLoadingSet((prev) => new Set(prev).add(nodeId))
    try {
      const res = await apiFetch(`/api/referrals/node/${nodeId}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? "Failed to load node")

      const parent = json.parent as any
      const children = (json.children ?? []) as any[]

      const parentNode: Node = {
        id: String(parent._id ?? parent.id),
        name: parent.name || parent.fullName,
        email: parent.email || "",
        referralCode: parent.referralCode,
        status: parent.status,
        activityStatus: parent.activityStatus,
        position: parent.position ?? null,
        joinedAt: parent.createdAt || parent.joinedAt,
      }

      const left = children.find((c) => c.position === "left")
      const right = children.find((c) => c.position === "right")

      const toNode = (u: any): Node => ({
        id: String(u._id ?? u.id),
        name: u.name || u.fullName,
        email: u.email || "",
        referralCode: u.referralCode,
        status: u.status,
        activityStatus: u.activityStatus,
        position: u.position ?? null,
        joinedAt: u.createdAt || u.joinedAt,
      })

      setNodesById((prev) => {
        const next = { ...prev }
        next[parentNode.id] = parentNode
        if (left) next[String(left._id ?? left.id)] = toNode(left)
        if (right) next[String(right._id ?? right.id)] = toNode(right)
        return next
      })

      setChildrenById((prev) => ({
        ...prev,
        [nodeId]: {
          left: left ? String(left._id ?? left.id) : undefined,
          right: right ? String(right._id ?? right.id) : undefined,
        },
      }))

      setParentById((prev) => {
        const next = { ...prev }
        if (left) next[String(left._id ?? left.id)] = nodeId
        if (right) next[String(right._id ?? right.id)] = nodeId
        return next
      })

      setLoadedChildren((prev) => ({ ...prev, [nodeId]: true }))
    } finally {
      setLoadingSet((prev) => {
        const next = new Set(prev)
        next.delete(nodeId)
        return next
      })
    }
  }

  async function onToggleExpand(nodeId: string) {
    if (!loadedChildren[nodeId]) {
      try {
        await ensureChildrenLoaded(nodeId)
      } catch (e: any) {
        setError(String(e?.message ?? e))
        return
      }
    }

    setExpandedSet((prev) => {
      const next = new Set(prev)
      next.has(nodeId) ? next.delete(nodeId) : next.add(nodeId)
      return next
    })
  }

  const stats = data?.stats ?? null
  const selected = selectedId ? nodesById[selectedId] : null
  const parentId = selectedId ? parentById[selectedId] : undefined

  const breadcrumb = useMemo(() => {
    if (!selectedId) return []
    const path: Node[] = []
    let cur: string | undefined = selectedId
    let guard = 0
    while (cur && nodesById[cur] && guard < 50) {
      path.push(nodesById[cur])
      cur = parentById[cur]
      guard++
    }
    return path.reverse()
  }, [selectedId, nodesById, parentById])

  const canPrev = offset > 0
  const canNext = list ? offset + limit < list.total : false

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-zinc-50">
      <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-sky-600 text-white">
                <Network className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-zinc-800">Referral Network</span>
            </div>

            <h1 className="mt-4 text-3xl  tracking-tight text-zinc-900 sm:text-4xl">
              Referral Network
            </h1>
            <p className="mt-2 text-sm text-zinc-600">
              Tree View (lazy-load) + List View (search + pagination) for large networks.
            </p>
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
          <div className="flex gap-2">
            <button
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
            </button>

            <button
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
            </button>
          </div>

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
                <GitBranch className="mr-2 h-4 w-4" /> Left: {stats.directLeft}
              </Badge>
              <Badge>
                <GitBranch className="mr-2 h-4 w-4" /> Right: {stats.directRight}
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
              Tip: Use Tree View for placement navigation; use List View for search and management.
            </p>
          </div>
        ) : null}

        {/* CONTENT */}
        {view === "list" ? (
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
                    <th className="py-3 px-4 ">Position</th>
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
                      <tr
                        key={u.id}
                        className="border-t border-zinc-200 hover:bg-emerald-50/40 transition-colors"
                      >
                        <td className="py-3 px-4 align-top">
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs  text-emerald-700">
                            L{u.level}
                          </span>
                        </td>

                        {/* USER + Collapsible Referred By */}
                        <td className="py-3 px-4 align-top">
                          <div className="font-semibold text-zinc-900">{u.name}</div>
                          <div className="text-xs text-zinc-600">{u.email}</div>

                          {rb ? (
                            <div className="mt-2">
                              <button
                                type="button"
                                onClick={() => toggleReferredBy(u.id)}
                                className="inline-flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px]  text-sky-800 hover:bg-sky-100"
                                title="Show / hide referred by"
                              >
                                <span className="text-sky-700">Referred by:</span>
                                <span className="max-w-[180px] truncate">{rb.name}</span>
                                <span className="ml-1 text-sky-700">{isOpen ? "▲" : "▼"}</span>
                              </button>

                              {isOpen ? (
                                <div className="mt-2 rounded-2xl border border-zinc-200 bg-white p-3 text-[11px] text-zinc-700 shadow-sm">
                                  <div className=" text-zinc-900">{rb.name}</div>
                                  <div className="mt-0.5 text-zinc-600">{rb.email || "—"} {rb.mobile || "—"}</div>

                                  {rb.referralCode ? (
                                    <div className="mt-2 flex flex-wrap items-center gap-2">
                                      <span className="text-zinc-600">Code:</span>
                                      <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-0.5 font-mono text-[11px]  text-emerald-800">
                                        {rb.referralCode}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => navigator.clipboard.writeText(rb.referralCode || "")}
                                        className="rounded-lg border border-emerald-200 bg-white px-2 py-0.5 text-[11px]  text-emerald-800 hover:bg-emerald-50"
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
                          )}
                        </td>

                        <td className="py-3 px-4 font-mono text-xs  text-sky-800 align-top">
                          {u.referralCode}
                        </td>

                        <td className="py-3 px-4 align-top">
                          {u.position ? (
                            <span className="rounded-full border border-sky-200 bg-sky-50 px-2 py-1 text-xs  text-sky-700">
                              {u.position.toUpperCase()}
                            </span>
                          ) : (
                            <span className="text-zinc-400">—</span>
                          )}
                        </td>

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

                        <td className="py-3 px-4 text-xs text-zinc-700 align-top">
                          {new Date(u.joinedAt).toLocaleString()}
                        </td>

                        <td className="py-3 px-4 align-top">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => navigator.clipboard.writeText(u.referralCode)}
                              className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs  text-emerald-800 hover:bg-emerald-50"
                              title="Copy code"
                            >
                              <Share2 className="h-3 w-3" />
                              Copy
                            </button>
                          </div>
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
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            {/* Tree */}
            <div className="lg:col-span-2 rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              {rootId ? (
                <BinaryTree
                  nodeId={rootId}
                  level={0}
                  nodesById={nodesById}
                  childrenById={childrenById}
                  expandedSet={expandedSet}
                  loadingSet={loadingSet}
                  loadedChildren={loadedChildren}
                  onToggleExpand={onToggleExpand}
                  onSelect={setSelectedId}
                  selectedId={selectedId}
                  maxRenderDepth={maxRenderDepth}
                />
              ) : (
                <div className="p-12 text-center">
                  <div className="mx-auto mb-4 flex h-20 w-20 animate-pulse items-center justify-center rounded-full bg-gradient-to-br from-emerald-100 to-sky-100 text-4xl">
                    🌟
                  </div>
                  <p className="text-sm font-semibold text-zinc-600">Loading your network...</p>
                </div>
              )}
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
                        {n.name || n.email}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {selected ? (
                <div className="space-y-3">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-sm  text-zinc-900">{selected.name || selected.email}</div>
                    <div className="mt-1 text-xs text-zinc-600">{selected.email}</div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs  text-emerald-700">
                        {selected.status ?? "active"}
                      </span>
                      <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs  text-zinc-700">
                        {selected.activityStatus ?? "inactive"}
                      </span>
                      {selected.position ? (
                        <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs  text-sky-700">
                          {selected.position.toUpperCase()}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3">
                      <div className="text-xs text-zinc-600">Referral code</div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <code className="font-mono text-sm  text-emerald-700">{selected.referralCode}</code>
                        <button
                          type="button"
                          onClick={() => navigator.clipboard.writeText(selected.referralCode)}
                          className="rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs  text-emerald-800 hover:bg-emerald-50"
                        >
                          Copy
                        </button>
                      </div>
                    </div>

                    {selected.joinedAt ? (
                      <div className="mt-2 text-xs text-zinc-600">
                        Joined: {new Date(selected.joinedAt).toLocaleString()}
                      </div>
                    ) : null}
                  </div>

                  <div className="flex gap-2">
                    {parentId ? (
                      <button
                        type="button"
                        onClick={() => setSelectedId(parentId)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm  text-zinc-800 hover:bg-zinc-50"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Go to Parent
                      </button>
                    ) : (
                      <div className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2 text-center text-sm  text-zinc-600">
                        Root user
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-white p-4 text-xs text-zinc-600">
                    <b>Scalable:</b> Tree loads only expanded branches. List is paginated + searchable.
                  </div>
                </div>
              ) : (
                <div className="text-sm text-zinc-600">Click any node to see details.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
