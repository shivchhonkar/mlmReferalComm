"use client";

import Link from "next/link";
import { useEffect, useState, createContext, useContext, useMemo } from "react";
import { apiFetch } from "@/lib/apiClient";
import { ChevronDown, ChevronRight, Network } from "lucide-react";

type TreeNode = {
  id: string;
  email: string;
  referralCode: string;
  children: TreeNode[];
};

// Context to manage collapsed state across the entire tree
const CollapsedContext = createContext<{
  collapsedNodes: Set<string>;
  toggleNode: (nodeId: string) => void;
}>({
  collapsedNodes: new Set(),
  toggleNode: () => {},
});

function useCollapsedState() {
  return useContext(CollapsedContext);
}

function NodeView({ node, depth }: { node: TreeNode; depth: number }) {
  const { collapsedNodes, toggleNode } = useCollapsedState();
  const isCollapsed = collapsedNodes.has(node.id);

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow">
        <span className="rounded-md bg-blue-600 text-white px-3 py-1 text-xs font-bold">
          Level {depth}
        </span>
        <span className="text-sm font-semibold text-gray-800">{node.email}</span>
        <span className="text-xs px-2 py-1 rounded-md bg-blue-50 text-blue-700 font-mono">
          {node.referralCode}
        </span>
        {node.children.length > 0 && (
          <button
            onClick={() => toggleNode(node.id)}
            className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            {isCollapsed ? (
              <>
                <ChevronRight className="w-3 h-3" />
                Expand {node.children.length}
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3" />
                Collapse {node.children.length}
              </>
            )}
          </button>
        )}
      </div>
      {node.children.length > 0 && !isCollapsed ? (
        <div className="ml-6 mt-2 border-l-2 border-gray-300 pl-6">
          {node.children.map((c) => (
            <NodeView key={c.id} node={c} depth={depth + 1} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export default function ReferralsPage() {
  const [tree, setTree] = useState<TreeNode | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (nodeId: string) => {
    setCollapsedNodes(prev => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  useEffect(() => {
    apiFetch("/api/referrals?depth=5")
      .then(async (r) => {
        const json = await r.json();
        if (!r.ok) throw new Error(json?.error ?? "Failed to load");
        setTree(json.tree);
      })
      .catch((e) => setError(String(e?.message ?? e)));
  }, []);

  const contextValue = useMemo(() => ({
    collapsedNodes,
    toggleNode,
  }), [collapsedNodes]);

  return (
    <CollapsedContext.Provider value={contextValue}>
      <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900">
                Referral Network
              </h1>
              <p className="mt-2 text-sm text-gray-700">
                Visualize your binary tree structure and network growth
              </p>
            </div>
            <Link 
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-200 rounded-lg text-sm font-medium hover:shadow-md transition-shadow" 
              prefetch={false}
              href="/dashboard"
            >
              ← Back to Dashboard
            </Link>
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700 mb-6">
              ⚠️ {error}
            </div>
          ) : null}

          {tree ? (
            <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                  <Network className="w-6 h-6 text-blue-600" />
                </div>
                <h2 className="text-xl font-bold text-gray-800">Your Network Tree</h2>
              </div>
              
              <NodeView node={tree} depth={0} />
              
              <div className="mt-8 pt-6 border-t border-gray-200 flex items-start gap-3">
                <span className="text-2xl">ℹ</span>
                <p className="text-xs text-zinc-600">
                  <strong>Note:</strong> This view shows up to 5 levels of your referral network for optimal performance. 
                  Each level represents a generation in your binary tree structure. Click &ldquo;Collapse&rdquo; or &ldquo;Expand&rdquo; to manage tree visibility.
                </p>
              </div>
            </div>
          ) : (
            <div className="glass-panel rounded-2xl border border-gray-200 p-12 text-center">
              <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-br from-blue-500/20 to-gray-500/20 flex items-center justify-center text-4xl mb-4 animate-pulse">
                🌟
              </div>
              <p className="text-lg text-zinc-600">Loading your network...</p>
            </div>
          )}
        </div>
      </div>
    </CollapsedContext.Provider>
  );
}
