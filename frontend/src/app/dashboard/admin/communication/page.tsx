"use client";

import { useEffect, useMemo, useState } from "react";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { showErrorToast, showSuccessToast } from "@/lib/toast";

type UserRow = {
  _id: string;
  fullName?: string;
  name?: string;
  email?: string;
  mobile?: string;
  role?: string;
};

type ServiceRow = {
  _id: string;
  name?: string;
  slug?: string;
  status?: string;
  createdAt?: string;
  categoryId?: string | { _id?: string; name?: string; code?: string } | null;
};

type Channel = "email" | "sms" | "whatsapp";

type ShareLink = {
  userId: string;
  name: string;
  mobile: string;
  url: string;
};

type CommunicationLogRow = {
  _id: string;
  channel: Channel;
  status: "prepared" | "opened" | "sent";
  message?: string;
  shareUrl?: string;
  createdAt?: string;
  adminId?: { fullName?: string; name?: string; email?: string } | string;
  userId?: { fullName?: string; name?: string; email?: string; mobile?: string } | string;
  serviceIds?: Array<{ _id?: string; name?: string } | string>;
};

function sanitizeCustomMessage(input: string): string {
  return input
    // .replace(/selected services:[\s\S]*$/i, "")
    .replace(/please check these services:[\s\S]*$/i, "")
    .replace(/regards,\s*admin team/gi, "")
    .trim();
}

function addRegardsFooter(text: string): string {
  return `${text.trim()}\n\nRegards,\nAdmin Team`;
}

export default function AdminCommunicationPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [channel, setChannel] = useState<Channel>("whatsapp");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [userSearch, setUserSearch] = useState("");
  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("all");
  const [shareLinks, setShareLinks] = useState<ShareLink[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"compose" | "logs">("compose");
  const [logs, setLogs] = useState<CommunicationLogRow[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [logsLoadedOnce, setLogsLoadedOnce] = useState(false);
  const [logsError, setLogsError] = useState<string | null>(null);
  const [logsScrollTop, setLogsScrollTop] = useState(0);

  const LOG_ROW_HEIGHT = 132;
  const LOG_VIEW_HEIGHT = 560;
  const LOG_OVERSCAN = 6;

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    if (activeTab === "logs" && !logsLoadedOnce && !logsLoading) {
      void loadLogs({ silent: true });
    }
  }, [activeTab, logsLoadedOnce, logsLoading]);

  function objectIdToTime(id?: string): number {
    if (!id || id.length < 8) return 0;
    const tsHex = id.slice(0, 8);
    const seconds = Number.parseInt(tsHex, 16);
    return Number.isFinite(seconds) ? seconds * 1000 : 0;
  }

  async function loadData() {
    setLoading(true);
    try {
      const [usersRes, servicesRes] = await Promise.all([
        apiFetch("/api/admin/users?limit=500&role=user"),
        apiFetch("/api/admin/services"),
      ]);

      const usersBody = await readApiBody(usersRes);
      const servicesBody = await readApiBody(servicesRes);
      const usersJson = usersBody.json as { users?: UserRow[]; error?: string } | undefined;
      const servicesJson = servicesBody.json as { services?: ServiceRow[]; error?: string } | undefined;

      if (!usersRes.ok) throw new Error(usersJson?.error || usersBody.text || "Failed to load users");
      if (!servicesRes.ok) throw new Error(servicesJson?.error || servicesBody.text || "Failed to load services");

      const nextUsers = usersJson?.users ?? [];
      const nextServices = [...(servicesJson?.services ?? [])].sort((a, b) => {
        const aTime = a.createdAt ? new Date(a.createdAt).getTime() : objectIdToTime(a._id);
        const bTime = b.createdAt ? new Date(b.createdAt).getTime() : objectIdToTime(b._id);
        return bTime - aTime;
      });

      setUsers(nextUsers);
      setServices(nextServices);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  async function loadLogs(options?: { silent?: boolean }) {
    setLogsLoading(true);
    setLogsError(null);
    try {
      const res = await apiFetch("/api/admin/communication/logs?limit=5000");
      const body = await readApiBody(res);
      const data = body.json as { logs?: CommunicationLogRow[]; error?: string } | undefined;
      if (!res.ok) throw new Error(data?.error || body.text || "Failed to load communication logs");
      setLogs(data?.logs ?? []);
      setLogsLoadedOnce(true);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to load communication logs";
      setLogsError(errorMessage);
      setLogsLoadedOnce(true);
      if (!options?.silent) showErrorToast(errorMessage);
    } finally {
      setLogsLoading(false);
    }
  }

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) =>
      [u.fullName, u.name, u.email, u.mobile].some((v) => String(v || "").toLowerCase().includes(q))
    );
  }, [users, userSearch]);

  const filteredServices = useMemo(() => {
    const q = serviceSearch.trim().toLowerCase();
    return services.filter((s) => {
      const categoryId =
        typeof s.categoryId === "object" && s.categoryId?._id
          ? String(s.categoryId._id)
          : String(s.categoryId || "");
      const matchesCategory = selectedCategoryId === "all" || categoryId === selectedCategoryId;
      const matchesSearch =
        !q || [s.name, s.slug, s.status].some((v) => String(v || "").toLowerCase().includes(q));
      return matchesCategory && matchesSearch;
    });
  }, [services, serviceSearch, selectedCategoryId]);

  const categoryOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of services) {
      const id =
        typeof s.categoryId === "object" && s.categoryId?._id
          ? String(s.categoryId._id)
          : String(s.categoryId || "");
      const name =
        typeof s.categoryId === "object" && s.categoryId?.name
          ? String(s.categoryId.name)
          : "";
      if (!id) continue;
      if (!map.has(id)) map.set(id, name || "Unnamed category");
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [services]);

  function toggleUser(id: string) {
    setSelectedUsers((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleService(id: string) {
    setSelectedServices((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function buildComposedMessage() {
    const selectedServiceRows = services.filter((s) => selectedServices.includes(s._id));
    const serviceLines = selectedServiceRows.map(
      (s) => `- ${s.name || s._id}: ${window.location.origin}/services?serviceId=${encodeURIComponent(s._id)}`
    );
    const servicesSection = `\n${serviceLines.join("\n")}`;
    const customMessage = sanitizeCustomMessage(message);
    const body = customMessage
      ? `${customMessage}\n\n${servicesSection}`
      : `Hello,\nPlease check these services:\n${serviceLines.join("\n")}`;
    return addRegardsFooter(body);
  }

  async function trackShareActivity(input: {
    channel: Channel;
    status: "prepared" | "opened" | "sent";
    serviceIds: string[];
    message?: string;
    shareItems: Array<{ userId: string; shareUrl?: string }>;
  }) {
    try {
      await apiFetch("/api/admin/communication/track-share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(input),
      });
    } catch {
      // Keep sharing flow non-blocking if tracking API fails.
    }
  }

  async function sendNow() {
    if (selectedUsers.length === 0) {
      showErrorToast("Select at least one user");
      return;
    }
    if (selectedServices.length === 0) {
      showErrorToast("Select at least one service");
      return;
    }

    setSending(true);
    setShareLinks([]);
    try {
      const selectedServiceRows = services.filter((s) => selectedServices.includes(s._id));
      const selectedUserRows = users.filter((u) => selectedUsers.includes(u._id));
      const messageTemplate = buildComposedMessage();

      if (channel !== "email") {
        const links: ShareLink[] = selectedUserRows.map((u) => {
          const name = u.fullName || u.name || "User";
          const mobile = String(u.mobile || "").replace(/\D/g, "");
          const personalized = messageTemplate.replace(/\{name\}/g, name);
          const encoded = encodeURIComponent(personalized);
          const url =
            channel === "whatsapp"
              ? mobile
                ? `https://wa.me/${mobile}?text=${encoded}`
                : ""
              : mobile
                ? `sms:${mobile}?body=${encoded}`
                : "";
          return { userId: u._id, name, mobile: u.mobile || "", url };
        });

        setShareLinks(links);
        const valid = links.filter((l) => l.url);
        if (valid.length > 0) {
          void trackShareActivity({
            channel,
            status: "prepared",
            serviceIds: selectedServices,
            message: messageTemplate,
            shareItems: valid.map((v) => ({ userId: v.userId, shareUrl: v.url })),
          });
        }
        if (valid.length > 0) {
          showSuccessToast(`Prepared ${valid.length} ${channel.toUpperCase()} links`);
          setMessage("");
          if (channel === "whatsapp") {
            void trackShareActivity({
              channel: "whatsapp",
              status: "opened",
              serviceIds: selectedServices,
              message: messageTemplate,
              shareItems: valid.map((v) => ({ userId: v.userId, shareUrl: v.url })),
            });
            for (const link of valid) {
              window.open(link.url, "_blank", "noopener,noreferrer");
            }
          }
        } else {
          showErrorToast("No valid mobile numbers found for selected users");
        }
        return;
      }

      const res = await apiFetch("/api/admin/communication/send", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          channel,
          userIds: selectedUsers,
          serviceIds: selectedServices,
          message: message.trim() || undefined,
        }),
      });
      const payload = (await res.json()) as {
        error?: string;
        sent?: number;
        failed?: number;
        shareLinks?: ShareLink[];
      };
      if (!res.ok) throw new Error(payload.error || "Failed to send communication");

      showSuccessToast(`Email processed. Sent: ${payload.sent ?? 0}, Failed: ${payload.failed ?? 0}`);
      setMessage("");
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Failed to send communication");
    } finally {
      setSending(false);
    }
  }

  function openAllShareLinks() {
    const valid = shareLinks.filter((l) => l.url);
    if (valid.length === 0) return;
    void trackShareActivity({
      channel,
      status: "opened",
      serviceIds: selectedServices,
      message: message.trim() || undefined,
      shareItems: valid.map((v) => ({ userId: v.userId, shareUrl: v.url })),
    });
    for (const link of valid) {
      window.open(link.url, "_blank", "noopener,noreferrer");
    }
  }

  const totalLogHeight = logs.length * LOG_ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(logsScrollTop / LOG_ROW_HEIGHT) - LOG_OVERSCAN);
  const visibleCount = Math.ceil(LOG_VIEW_HEIGHT / LOG_ROW_HEIGHT) + LOG_OVERSCAN * 2;
  const endIndex = Math.min(logs.length, startIndex + visibleCount);
  const visibleLogs = logs.slice(startIndex, endIndex);

  return (
    <div className="space-y-5 p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">Communication</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Send selected service links to selected users via WhatsApp, SMS, or Email.
        </p>
      </div>

      <div className="inline-flex rounded-xl border border-zinc-200 bg-white p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("compose")}
          className={[
            "rounded-lg px-4 py-2 text-sm font-semibold transition hover:cursor-pointer",
            activeTab === "compose" ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50",
          ].join(" ")}
        >
          Compose
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("logs")}
          className={[
            "rounded-lg px-4 py-2 text-sm font-semibold transition hover:cursor-pointer",
            activeTab === "logs" ? "bg-emerald-600 text-white" : "text-zinc-700 hover:bg-zinc-50",
          ].join(" ")}
        >
          Last Communication Log
        </button>
      </div>

      {activeTab === "logs" && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Communication Records (Latest first)</h2>
            <button
              type="button"
              onClick={() => {
                setLogsLoadedOnce(false);
                void loadLogs();
              }}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:cursor-pointer"
            >
              Refresh
            </button>
          </div>
          {logsLoading ? (
            <p className="text-sm text-zinc-500">Loading logs...</p>
          ) : logsError ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
              {logsError}
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-zinc-500">No communication logs found.</p>
          ) : (
            <div
              className="relative overflow-y-auto rounded-xl border border-zinc-200 bg-zinc-50"
              style={{ height: `${LOG_VIEW_HEIGHT}px` }}
              onScroll={(e) => setLogsScrollTop(e.currentTarget.scrollTop)}
            >
              <div style={{ height: `${totalLogHeight}px`, position: "relative" }}>
                {visibleLogs.map((row, idx) => {
                  const absoluteIndex = startIndex + idx;
                  const top = absoluteIndex * LOG_ROW_HEIGHT;
                  const userObj =
                    typeof row.userId === "object" && row.userId ? row.userId : undefined;
                  const adminObj =
                    typeof row.adminId === "object" && row.adminId ? row.adminId : undefined;
                  const serviceNames = (row.serviceIds ?? [])
                    .map((s) => (typeof s === "object" && s?.name ? s.name : String(s || "")))
                    .filter(Boolean)
                    .join(", ");
                  return (
                    <div
                      key={row._id || `${absoluteIndex}`}
                      className="absolute left-0 right-0 border-b border-zinc-200 bg-white px-3 py-2"
                      style={{ top: `${top}px`, height: `${LOG_ROW_HEIGHT}px` }}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <p className="truncate text-xs font-semibold text-zinc-700">
                          {(row.channel || "").toUpperCase()} | {(row.status || "").toUpperCase()}
                        </p>
                        <p className="text-xs text-zinc-500">
                          {row.createdAt ? new Date(row.createdAt).toLocaleString() : "-"}
                        </p>
                      </div>
                      <p className="truncate text-xs text-zinc-700">
                        User: {userObj?.fullName || userObj?.name || "-"} | {userObj?.mobile || userObj?.email || "-"}
                      </p>
                      <p className="truncate text-xs text-zinc-700">
                        Admin: {adminObj?.fullName || adminObj?.name || adminObj?.email || "-"}
                      </p>
                      <p className="truncate text-xs text-zinc-700">Services: {serviceNames || "-"}</p>
                      <p className="line-clamp-1 text-xs text-zinc-600">
                        Message: {String(row.message || "").replace(/\s+/g, " ").trim() || "-"}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "compose" && (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Select Users</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedUsers(filteredUsers.map((u) => u._id))}
                className="text-xs font-medium text-emerald-700 hover:underline hover:cursor-pointer"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedUsers([])}
                className="text-xs font-medium text-zinc-600 hover:underline hover:cursor-pointer"
              >
                Deselect all
              </button>
            </div>
          </div>
          <input
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            placeholder="Search user by name/email/mobile"
            className="mb-3 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
          />
          <div className="max-h-80 space-y-2 overflow-auto pr-1">
            {loading ? (
              <p className="text-sm text-zinc-500">Loading users...</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-zinc-500">No users found.</p>
            ) : (
              filteredUsers.map((u) => {
                const checked = selectedUsers.includes(u._id);
                const title = u.fullName || u.name || "User";
                return (
                  <label
                    key={u._id}
                    className="flex items-start gap-2 rounded-lg border border-zinc-200 p-2 text-sm hover:bg-zinc-50 hover:cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={checked}
                      onChange={() => toggleUser(u._id)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-zinc-800">{title}</span>
                      <span className="block truncate text-xs text-zinc-500">
                        {u.mobile || "No mobile"} | {u.email || "No email"}
                      </span>
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-800">Select Services</h2>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedServices(filteredServices.map((s) => s._id))}
                className="text-xs font-medium text-emerald-700 hover:underline hover:cursor-pointer"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={() => setSelectedServices([])}
                className="text-xs font-medium text-zinc-600 hover:underline hover:cursor-pointer"
              >
                Deselect all
              </button>
            </div>
          </div>
          <div className="mb-3 grid grid-cols-1 gap-2 md:grid-cols-2">
            <input
              value={serviceSearch}
              onChange={(e) => setServiceSearch(e.target.value)}
              placeholder="Search by service name, slug, or status"
              className="w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm outline-none focus:border-emerald-500"
            />
            <select
              value={selectedCategoryId}
              onChange={(e) => setSelectedCategoryId(e.target.value)}
              className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-500"
            >
              <option value="all">All categories</option>
              {categoryOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="max-h-80 space-y-2 overflow-auto pr-1">
            {loading ? (
              <p className="text-sm text-zinc-500">Loading services...</p>
            ) : filteredServices.length === 0 ? (
              <p className="text-sm text-zinc-500">No services found.</p>
            ) : (
              filteredServices.map((s) => {
                const checked = selectedServices.includes(s._id);
                return (
                  <label
                    key={s._id}
                    className="flex items-start gap-2 rounded-lg border border-zinc-200 p-2 text-sm hover:bg-zinc-50 hover:cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4"
                      checked={checked}
                      onChange={() => toggleService(s._id)}
                    />
                    <span className="block truncate font-medium text-zinc-800">{s.name || "Service"}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-zinc-800">Channel & Message</h2>
          <div className="mb-3 grid grid-cols-3 gap-2">
            {(["whatsapp", "sms", "email"] as Channel[]).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setChannel(c)}
                className={[
                  "rounded-lg border px-3 py-2 text-xs font-medium transition hover:cursor-pointer",
                  channel === c
                    ? "border-emerald-600 bg-emerald-600 text-white"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50",
                ].join(" ")}
              >
                {c.toUpperCase()}
              </button>
            ))}
          </div>

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={8}
            placeholder="Optional custom message. Use {name} for user name personalization."
            className="w-full rounded-lg border border-zinc-300 p-3 text-sm outline-none focus:border-emerald-500"
          />
          <p className="mt-2 text-xs text-zinc-500">
            If blank, a default message is used with selected service links.
          </p>

          <button
            type="button"
            onClick={sendNow}
            disabled={sending || loading}
            className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            {sending ? "Sending..." : channel === "whatsapp" ? "Share by WhatsApp" : `Send via ${channel.toUpperCase()}`}
          </button>
          <button
            type="button"
            onClick={() => setPreviewOpen(true)}
            disabled={loading || selectedServices.length === 0}
            className="mt-2 w-full rounded-xl border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 hover:cursor-pointer disabled:cursor-not-allowed disabled:opacity-60"
          >
            Preview message
          </button>

          <p className="mt-2 text-xs text-zinc-500">
            Selected: {selectedUsers.length} users, {selectedServices.length} services
          </p>
        </div>
      </div>
      )}

      {shareLinks.length > 0 && (
        <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-800">Prepared {channel.toUpperCase()} Links</h3>
            <button
              type="button"
              onClick={openAllShareLinks}
              className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 hover:bg-zinc-50 hover:cursor-pointer"
            >
              Open all valid links
            </button>
          </div>
          <div className="max-h-72 space-y-2 overflow-auto pr-1">
            {shareLinks.map((row) => (
              <div key={row.userId} className="flex items-center justify-between rounded-lg border border-zinc-200 p-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-zinc-800">{row.name}</p>
                  <p className="truncate text-xs text-zinc-500">{row.mobile || "No mobile number"}</p>
                </div>
                {row.url ? (
                  <a
                    href={row.url}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => {
                      void trackShareActivity({
                        channel,
                        status: "opened",
                        serviceIds: selectedServices,
                        message: message.trim() || undefined,
                        shareItems: [{ userId: row.userId, shareUrl: row.url }],
                      });
                    }}
                    className="rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 hover:cursor-pointer"
                  >
                    Open
                  </a>
                ) : (
                  <span className="text-xs text-red-600">Invalid mobile</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {previewOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-base font-semibold text-zinc-900">Message Preview</h3>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 hover:cursor-pointer"
              >
                Close
              </button>
            </div>
            <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3">
              <pre className="whitespace-pre-wrap break-words text-sm text-zinc-800">{buildComposedMessage()}</pre>
            </div>
            <p className="mt-2 text-xs text-zinc-500">
              This is the exact message that will be shared with selected users.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
