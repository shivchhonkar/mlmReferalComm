"use client";

import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { useAuth } from "@/lib/useAuth";
import {
  Users,
  Plus,
  Search,
  MoreVertical,
  Ban,
  CheckCircle,
  ArrowLeft,
  X,
  Eye,
  EyeOff,
  Mail,
  Phone,
  Lock,
  UserCircle,
  UserPlus,
  AlertTriangle,
  Pencil,
  Trash2,
  RefreshCcw,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

interface User {
  _id: string;
  name: string;
  fullName: string;
  email: string;
  mobile: string;
  role: "super_admin" | "admin" | "moderator" | "user";
  status: "active" | "suspended" | "deleted";
  activityStatus: "active" | "inactive";
  kycStatus: "pending" | "submitted" | "verified" | "rejected";
  createdAt: string;
  lastLoginAt?: string;
  lastLogoutAt?: string;
  parent?: {
    name: string;
    email: string;
    mobile: string;
  };
}

interface UsersResponse {
  users: User[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

/**
 * ✅ Admin can manage users (activate/suspend, edit user basic fields).
 * ✅ Super admin can additionally: promote/demote roles, delete users.
 * ✅ Prevent self-destruction (cannot suspend/delete yourself).
 *
 * NOTE: This UI assumes backend endpoints exist:
 * - GET  /api/admin/users?page=&limit=&search=&role=&status=
 * - POST /api/admin/users
 * - PUT  /api/admin/users/:id/status   { status }
 * - PUT  /api/admin/users/:id         { fullName?, email?, mobile?, role?, status? }
 * - DELETE /api/admin/users/:id
 * - PUT  /api/admin/users/:id/referral { referralCode, position? }
 *
 * If your backend doesn't have PUT/DELETE yet, UI will show friendly errors.
 */

function UsersPage() {
  const { user: currentUser } = useAuth({ requireAdmin: true });
  const searchParams = useSearchParams();

  const isSuperAdmin = (currentUser as any)?.role === "super_admin";
  const isAdmin = (currentUser as any)?.role === "admin" || isSuperAdmin;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState<string | null>(null); // userId being mutated (for row-level loading)
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0,
  });

  // Create user modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Referral assignment modal
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [selectedUserForReferral, setSelectedUserForReferral] = useState<User | null>(null);
  const [assigningReferral, setAssigningReferral] = useState(false);
  const [referralForm, setReferralForm] = useState({
    referralCode: "",
    position: "" as "" | "left" | "right",
  });

  // Edit user modal
  const [showEditModal, setShowEditModal] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState<User | null>(null);
  const [editForm, setEditForm] = useState({
    fullName: "",
    email: "",
    mobile: "",
    role: "user" as User["role"],
    status: "active" as User["status"],
  });

  // Row actions menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  // Initialize filters from URL parameters
  useEffect(() => {
    const role = searchParams.get("role");
    const status = searchParams.get("status");
    if (role) setRoleFilter(role);
    if (status) setStatusFilter(status);
  }, [searchParams]);

  // Close menu when clicking outside
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current) return;
      const t = e.target as Node;
      if (!menuRef.current.contains(t)) setOpenMenuId(null);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm, roleFilter, statusFilter]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
        ...(searchTerm && { search: searchTerm }),
        ...(roleFilter && { role: roleFilter }),
        ...(statusFilter && { status: statusFilter }),
      });

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || data?.message || "Failed to fetch users");
      }

      const data: UsersResponse = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const isSelf = (userId: string) => {
    const myId = (currentUser as any)?.id || (currentUser as any)?._id;
    return myId && String(myId) === String(userId);
  };

  const canManageTarget = (target: User) => {
    // Super admin can manage everyone (except safety checks below)
    if (isSuperAdmin) return true;
    // Admin can manage moderators + users, but not admin/super_admin
    if ((currentUser as any)?.role === "admin") {
      return target.role === "moderator" || target.role === "user";
    }
    return false;
  };

  const updateUserStatus = async (target: User, status: User["status"]) => {
    try {
      setError(null);

      if (!canManageTarget(target)) {
        showErrorToast("You don't have permission to manage this user.");
        return;
      }
      if (isSelf(target._id) && (status === "suspended" || status === "deleted")) {
        showErrorToast("You can't suspend/delete your own account.");
        return;
      }

      setMutating(target._id);
      const response = await fetch(`/api/admin/users/${target._id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || "Failed to update user status");

      globalThis.localStorage.setItem("admin-action-updated", Date.now().toString());
      showSuccessToast(data?.message || "User updated");
      await fetchUsers();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setMutating(null);
    }
  };

  const deleteUser = async (target: User) => {
    try {
      setError(null);

      if (!isSuperAdmin) {
        showErrorToast("Only Super Admin can delete users.");
        return;
      }
      if (isSelf(target._id)) {
        showErrorToast("You can't delete your own account.");
        return;
      }

      const ok = confirm(`Delete user "${target.fullName}"? This action cannot be undone.`);
      if (!ok) return;

      setMutating(target._id);

      const response = await fetch(`/api/admin/users/${target._id}`, {
        method: "DELETE",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || "Failed to delete user");

      showSuccessToast(data?.message || "User deleted");
      await fetchUsers();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to delete user");
    } finally {
      setMutating(null);
    }
  };

  const openEditModal = (u: User) => {
    if (!canManageTarget(u)) {
      showErrorToast("You don't have permission to edit this user.");
      return;
    }
    setSelectedUserForEdit(u);
    setEditForm({
      fullName: u.fullName || "",
      email: u.email || "",
      mobile: u.mobile || "",
      role: u.role,
      status: u.status,
    });
    setShowEditModal(true);
  };

  const saveEdit = async () => {
    if (!selectedUserForEdit) return;

    const target = selectedUserForEdit;

    // basic validations
    if (!editForm.fullName.trim()) {
      showErrorToast("Full name is required");
      return;
    }
    if (editForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(editForm.email)) {
      showErrorToast("Valid email is required");
      return;
    }
    if (!editForm.mobile.trim() || editForm.mobile.replace(/\D/g, "").length < 10) {
      showErrorToast("Valid mobile number is required (min 10 digits)");
      return;
    }

    // role changes allowed only for super admin
    if (!isSuperAdmin && editForm.role !== target.role) {
      showErrorToast("Only Super Admin can change roles.");
      return;
    }

    // cannot suspend/delete self
    if (isSelf(target._id) && (editForm.status === "suspended" || editForm.status === "deleted")) {
      showErrorToast("You can't suspend/delete your own account.");
      return;
    }

    setSavingEdit(true);
    try {
      const response = await fetch(`/api/admin/users/${target._id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editForm.fullName.trim(),
          email: editForm.email ? editForm.email.trim() : undefined,
          mobile: editForm.mobile.replace(/\D/g, ""),
          role: editForm.role,
          status: editForm.status,
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || "Failed to update user");

      showSuccessToast(data?.message || "User updated");
      setShowEditModal(false);
      setSelectedUserForEdit(null);
      await fetchUsers();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to update user");
    } finally {
      setSavingEdit(false);
    }
  };

  const createUserFormRoleOptions = useMemo(() => {
    // Admin can create: user/moderator
    // Super admin can create: all
    const base = [
      // { value: "user", label: "User" },
      { value: "moderator", label: "Moderator" },
    ];
    if (isSuperAdmin) {
      base.push({ value: "admin", label: "Admin" });
      base.push({ value: "super_admin", label: "Super Admin" });
    }
    return base as { value: User["role"]; label: string }[];
  }, [isSuperAdmin]);

  // Create user form state
  const [createUserForm, setCreateUserForm] = useState({
    name: "",
    email: "",
    mobile: "",
    countryCode: "+91",
    password: "",
    confirmPassword: "",
    role: "user" as User["role"],
  });

  const createUser = async () => {
    if (!isAdmin) return;

    // Validation
    if (!createUserForm.name.trim()) {
      showErrorToast("Name is required");
      return;
    }
    if (!createUserForm.mobile.trim() || createUserForm.mobile.replace(/\D/g, "").length < 10) {
      showErrorToast("Valid mobile number is required (min 10 digits)");
      return;
    }
    if (createUserForm.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createUserForm.email)) {
      showErrorToast("Valid email is required");
      return;
    }
    if (createUserForm.password.length < 8) {
      showErrorToast("Password must be at least 8 characters");
      return;
    }
    if (createUserForm.password !== createUserForm.confirmPassword) {
      showErrorToast("Passwords do not match");
      return;
    }

    // Admin restrictions: cannot create admin/super_admin
    if (!isSuperAdmin && (createUserForm.role === "admin" || createUserForm.role === "super_admin")) {
      showErrorToast("Only Super Admin can create Admin/Super Admin users.");
      return;
    }

    setCreating(true);
    try {
      const response = await fetch("/api/admin/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: createUserForm.name,
          email: createUserForm.email || undefined,
          mobile: createUserForm.mobile.replace(/\D/g, ""),
          countryCode: createUserForm.countryCode,
          password: createUserForm.password,
          role: createUserForm.role,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to create user");
      }

      showSuccessToast(data.message || "User created successfully");
      setShowCreateModal(false);

      setCreateUserForm({
        name: "",
        email: "",
        mobile: "",
        countryCode: "+91",
        password: "",
        confirmPassword: "",
        role: "user",
      });

      await fetchUsers();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to create user");
    } finally {
      setCreating(false);
    }
  };

  const openReferralModal = (user: User) => {
    if (!isSuperAdmin) {
      showErrorToast("Only Super Admin can assign referral parent.");
      return;
    }
    setSelectedUserForReferral(user);
    setReferralForm({ referralCode: "", position: "" });
    setShowReferralModal(true);
  };

  const assignReferral = async () => {
    if (!selectedUserForReferral) return;

    if (!referralForm.referralCode.trim()) {
      showErrorToast("Referral code is required");
      return;
    }

    setAssigningReferral(true);
    try {
      const response = await fetch(`/api/admin/users/${selectedUserForReferral._id}/referral`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralCode: referralForm.referralCode.trim(),
          ...(referralForm.position && { position: referralForm.position }),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error || data?.message || "Failed to assign referral");

      showSuccessToast(data.message || "Referral assigned successfully");
      setShowReferralModal(false);
      setSelectedUserForReferral(null);
      setReferralForm({ referralCode: "", position: "" });
      await fetchUsers();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to assign referral");
    } finally {
      setAssigningReferral(false);
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "super_admin":
        return "border-sky-200 bg-sky-50 text-sky-800";
      case "admin":
        return "border-indigo-200 bg-indigo-50 text-indigo-800";
      case "moderator":
        return "border-emerald-200 bg-emerald-50 text-emerald-800";
      default:
        return "border-zinc-200 bg-zinc-50 text-zinc-800";
    }
  };

  const getActivityStatusBadgeColor = (activityStatus: string) => {
    switch (activityStatus) {
      case "active":
        return "border-emerald-200 bg-emerald-50 text-emerald-800";
      case "inactive":
        return "border-amber-200 bg-amber-50 text-amber-800";
      default:
        return "border-zinc-200 bg-zinc-50 text-zinc-800";
    }
  };

  const getAccountStatusBadgeColor = (status: string) => {
    switch (status) {
      case "active":
        return "border-sky-200 bg-sky-50 text-sky-800";
      case "suspended":
        return "border-red-200 bg-red-50 text-red-800";
      case "deleted":
        return "border-zinc-200 bg-zinc-50 text-zinc-800";
      default:
        return "border-zinc-200 bg-zinc-50 text-zinc-800";
    }
  };

  const getKycBadgeColor = (status: string) => {
    switch (status) {
      case "verified":
        return "border-emerald-200 bg-emerald-50 text-emerald-800";
      case "submitted":
        return "border-amber-200 bg-amber-50 text-amber-800";
      case "rejected":
        return "border-red-200 bg-red-50 text-red-800";
      default:
        return "border-zinc-200 bg-zinc-50 text-zinc-800";
    }
  };

  const canUseCreate = isAdmin;
  const canEdit = (u: User) => canManageTarget(u);
  const canSuspend = (u: User) => canManageTarget(u) && !isSelf(u._id);
  const canDelete = (u: User) => isSuperAdmin && !isSelf(u._id);

  if (loading && users.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-zinc-50">
        <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="animate-pulse">
            <div className="h-8 w-1/3 rounded bg-zinc-200 mb-4" />
            <div className="h-4 w-1/2 rounded bg-zinc-200 mb-8" />
            <div className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 py-4 border-b border-zinc-100 last:border-b-0"
                >
                  <div className="h-10 w-10 rounded-2xl bg-zinc-200" />
                  <div className="flex-1">
                    <div className="h-4 w-1/4 rounded bg-zinc-200 mb-2" />
                    <div className="h-3 w-1/3 rounded bg-zinc-200" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-zinc-50">
      <div className="h-1.5 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            {/* <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-white/70 px-3 py-1.5 shadow-sm backdrop-blur">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-emerald-600 to-sky-600 text-white">
                <Users className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold text-zinc-800">Admin</span>
            </div> */}

            <h1 className="mt-4 text-3xl font-bold tracking-tight text-zinc-900 sm:text-4xl">
              User Management
            </h1>

            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-600">
              <span className="inline-flex items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1 font-semibold">
                <Shield className="h-4 w-4 text-emerald-700" />
                Role:{" "}
                <span className=" text-zinc-900">
                  {(currentUser as any)?.role ?? "—"}
                </span>
              </span>
              <span className="text-zinc-500">•</span>
              <span>Manage users, status, and permissions.</span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <button
              onClick={fetchUsers}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
              type="button"
              title="Refresh list"
            >
              <RefreshCcw className={["h-4 w-4", loading ? "animate-spin" : ""].join(" ")} />
              Refresh
            </button>

            <Link
              href="/admin"
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-800 shadow-sm transition hover:bg-zinc-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Link>

            <button
              onClick={() => {
                if (!canUseCreate) return showErrorToast("You don't have permission to create users.");
                setShowCreateModal(true);
              }}
              className={[
                "inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-2.5 text-sm font-bold shadow-lg transition",
                canUseCreate
                  ? "bg-gradient-to-r from-emerald-600 to-sky-600 text-white hover:from-emerald-700 hover:to-sky-700 hover:shadow-xl"
                  : "border border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed shadow-none",
              ].join(" ")}
              type="button"
              disabled={!canUseCreate}
              title={!canUseCreate ? "Only Admin/Super Admin can create users" : "Create user"}
            >
              <Plus className="h-4 w-4" />
              Create User
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-[1fr_220px_220px]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                placeholder="Search users by name, email, mobile..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 !pl-12 pr-4 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
              />
            </div>

            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-800 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
            >
              <option value="">All Roles</option>
              <option value="super_admin">Super Admin</option>
              <option value="admin">Admin</option>
              <option value="moderator">Moderator</option>
              <option value="user">User</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm font-semibold text-zinc-800 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
            >
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
              <option value="deleted">Deleted</option>
            </select>
          </div>

          {!isSuperAdmin ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
              ℹ️ Admins can manage only <b>Users</b> and <b>Moderators</b>. Only Super Admin can change roles or delete users.
            </div>
          ) : null}
        </div>

        {/* Error */}
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-white p-4 text-sm font-semibold text-red-700 shadow-sm">
            ⚠️ {error}
          </div>
        ) : null}

        {/* Table */}
        <div className="rounded-3xl0 border border-zinc-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gradient-to-r from-emerald-50 to-sky-50 border-b border-zinc-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Activity / Account
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    KYC
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-bold text-zinc-700 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-100">
                {users.map((u) => {
                  const rowBusy = mutating === u._id;

                  return (
                    <tr
                      key={u._id}
                      className={[
                        "transition-colors",
                        !u.parent && (u.role === "user" || "moderator") ? "bg-amber-50/50 hover:bg-amber-100/50" : "hover:bg-zinc-50/70",
                      ].join(" ")}
                    >
                      <td className="px-6 py-4 align-top">
                        <div className="flex items-start gap-2">
                          {!u.parent && u.role === "user" && (
                            <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                          )}
                          <div>
                            <div className="text-sm text-zinc-900 font-bold">{u.fullName}</div>
                            {!u.fullName && <div className="text-sm text-zinc-500">{u.name}</div>}
                            {u.parent ? (
                              <div className="mt-1 text-xs text-[10px] text-zinc-400">
                                Referred by: {u.parent.name}
                              </div>
                            ) : u.role === "user" ? (
                              <div className="mt-1 text-xs text-amber-600 font-semibold">
                                ⚠️ No referral parent
                              </div>
                            ) : null}
                            {isSelf(u._id) ? (
                              <div className="mt-1 text-xs font-bold text-sky-700">You</div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="text-sm text-zinc-900">{u.email || "—"}</div>
                        <div className="text-sm text-zinc-500">{u.mobile || "—"}</div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs",
                            getRoleBadgeColor(u.role),
                          ].join(" ")}
                        >
                          {u.role.replace("_", " ").toUpperCase()}
                        </span>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={[
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs",
                              getActivityStatusBadgeColor(u.activityStatus),
                            ].join(" ")}
                          >
                            {u.activityStatus.toUpperCase()}
                          </span>

                          <span
                            className={[
                              "inline-flex items-center rounded-xl border px-2 py-0.5 text-xs",
                              getAccountStatusBadgeColor(u.status),
                            ].join(" ")}
                          >
                            {u.status.toUpperCase()}
                          </span>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <span
                          className={[
                            "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs",
                            getKycBadgeColor(u.kycStatus),
                          ].join(" ")}
                        >
                          {u.kycStatus.replace("_", " ").toUpperCase()}
                        </span>
                      </td>

                      <td className="px-6 py-4 align-top text-sm text-zinc-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2">
                          {/* Assign referral (super admin only) */}
                          {!u.parent && u.role === "user" && isSuperAdmin ? (
                            <button
                              onClick={() => openReferralModal(u)}
                              className="inline-flex items-center justify-center rounded-xl border border-sky-200 bg-sky-50 p-2 text-sky-700 transition hover:bg-sky-100"
                              title="Assign Referral Parent"
                              type="button"
                              disabled={rowBusy}
                            >
                              <UserPlus className="h-4 w-4" />
                            </button>
                          ) : null}

                          {/* Quick suspend/activate */}
                          {u.status === "active" ? (
                            <button
                              onClick={() => updateUserStatus(u, "suspended")}
                              className={[
                                "inline-flex items-center justify-center rounded-xl border p-2 transition",
                                canSuspend(u)
                                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                                  : "border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed",
                              ].join(" ")}
                              title={canSuspend(u) ? "Suspend User" : "No permission"}
                              type="button"
                              disabled={!canSuspend(u) || rowBusy}
                            >
                              <Ban className="h-4 w-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => updateUserStatus(u, "active")}
                              className={[
                                "inline-flex items-center justify-center rounded-xl border p-2 transition",
                                canManageTarget(u)
                                  ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                  : "border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed",
                              ].join(" ")}
                              title={canManageTarget(u) ? "Activate User" : "No permission"}
                              type="button"
                              disabled={!canManageTarget(u) || rowBusy}
                            >
                              <CheckCircle className="h-4 w-4" />
                            </button>
                          )}

                          {/* Menu */}
                          <div className="relative" ref={openMenuId === u._id ? menuRef : null}>
                            <button
                              className="inline-flex items-center justify-center rounded-xl border border-zinc-200 bg-white p-2 text-zinc-600 transition hover:bg-zinc-50"
                              type="button"
                              title="More"
                              onClick={() => setOpenMenuId((prev) => (prev === u._id ? null : u._id))}
                              disabled={rowBusy}
                            >
                              <MoreVertical className="h-4 w-4" />
                            </button>

                            {openMenuId === u._id ? (
                              <div className="absolute right-0 mt-2 w-56 overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl z-20">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    openEditModal(u);
                                  }}
                                  disabled={!canEdit(u)}
                                  className={[
                                    "flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-left transition",
                                    canEdit(u) ? "hover:bg-zinc-50 text-zinc-800" : "text-zinc-400 cursor-not-allowed",
                                  ].join(" ")}
                                >
                                  <Pencil className="h-4 w-4" />
                                  Edit User
                                </button>

                                <div className="h-px bg-zinc-100" />

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenMenuId(null);
                                    if (!canDelete(u)) return showErrorToast("Only Super Admin can delete users.");
                                    deleteUser(u);
                                  }}
                                  disabled={!canDelete(u)}
                                  className={[
                                    "flex w-full items-center gap-2 px-4 py-2.5 text-sm font-bold text-left transition",
                                    canDelete(u) ? "hover:bg-red-50 text-red-700" : "text-zinc-400 cursor-not-allowed",
                                  ].join(" ")}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  Delete User
                                </button>
                              </div>
                            ) : null}
                          </div>

                          {rowBusy ? (
                            <div className="ml-1 inline-flex items-center gap-2 text-xs font-bold text-zinc-500">
                              <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                              Updating...
                            </div>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="border-t border-zinc-200 bg-zinc-50 px-6 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-zinc-700">
                Showing{" "}
                <span className="font-semibold">
                  {pagination.total === 0 ? 0 : (currentPage - 1) * pagination.limit + 1}
                </span>{" "}
                to{" "}
                <span className="font-semibold">
                  {Math.min(currentPage * pagination.limit, pagination.total)}
                </span>{" "}
                of <span className="font-semibold">{pagination.total}</span> results
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
                  type="button"
                >
                  Previous
                </button>

                <span className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700">
                  Page <span className="font-bold">{currentPage}</span> of{" "}
                  <span className="font-bold">{pagination.pages || 1}</span>
                </span>

                <button
                  onClick={() => setCurrentPage(Math.min(pagination.pages || 1, currentPage + 1))}
                  disabled={currentPage === (pagination.pages || 1)}
                  className="rounded-2xl border border-zinc-200 bg-white px-4 py-2 text-sm font-bold text-zinc-800 shadow-sm transition hover:bg-zinc-50 disabled:opacity-50"
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Create User Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-600 text-white shadow-md">
                    <Users className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl  text-zinc-900">Create New User</h2>
                    <p className="text-sm text-zinc-500">Add a new user account</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-2xl border border-zinc-200 p-2 text-zinc-600 transition hover:bg-zinc-50"
                  type="button"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    Full Name <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <UserCircle className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="text"
                      placeholder="Enter full name"
                      value={createUserForm.name}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, name: e.target.value })}
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 !pl-12 pr-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                    <input
                      type="email"
                      placeholder="user@example.com"
                      value={createUserForm.email}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, email: e.target.value })}
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 !pl-12 pr-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    Mobile Number <span className="text-red-600">*</span>
                  </label>
                  <div className="flex gap-3">
                    <select
                      value={createUserForm.countryCode}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, countryCode: e.target.value })}
                      className="rounded-2xl max-w-[100px] border border-zinc-200 bg-zinc-50 px-3 py-3 text-sm font-semibold text-zinc-800 focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition"
                    >
                      <option value="+91">+91</option>
                      <option value="+1">+1</option>
                      <option value="+44">+44</option>
                    </select>
                    <div className="relative flex-1">
                      <Phone className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                      <input
                        type="tel"
                        placeholder="10 digit mobile number"
                        value={createUserForm.mobile}
                        onChange={(e) =>
                          setCreateUserForm({ ...createUserForm, mobile: e.target.value.replace(/\D/g, "") })
                        }
                        className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 !pl-12 pr-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    User Role <span className="text-red-600">*</span>
                  </label>
                  <select
                    value={createUserForm.role}
                    onChange={(e) => setCreateUserForm({ ...createUserForm, role: e.target.value as any })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-800 focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition"
                  >
                    {createUserFormRoleOptions.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                  {!isSuperAdmin ? (
                    <p className="mt-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-medium text-amber-800">
                      ℹ️ Admin can create only User/Moderator. (Super Admin required for Admin/Super Admin)
                    </p>
                  ) : null}
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                    <input
                      type={showPassword ? "text" : "password"}
                      placeholder="Minimum 8 characters"
                      value={createUserForm.password}
                      onChange={(e) => setCreateUserForm({ ...createUserForm, password: e.target.value })}
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 !pl-12 pr-12 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    Confirm Password <span className="text-red-600">*</span>
                  </label>
                  <div className="relative">
                    <Lock className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="Re-enter password"
                      value={createUserForm.confirmPassword}
                      onChange={(e) =>
                        setCreateUserForm({ ...createUserForm, confirmPassword: e.target.value })
                      }
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 !pl-12 pr-12 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 transition"
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {createUserForm.confirmPassword &&
                    createUserForm.password !== createUserForm.confirmPassword && (
                      <p className="mt-1.5 text-xs text-red-600">Passwords do not match</p>
                    )}
                </div>
              </div>

              <div className="mt-8 flex justify-end gap-3">
                <button
                  onClick={() => setShowCreateModal(false)}
                  disabled={creating}
                  className="rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={createUser}
                  disabled={creating}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:from-emerald-700 hover:to-sky-700 hover:shadow-xl disabled:opacity-50"
                  type="button"
                >
                  {creating ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4" />
                      Create User
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit User Modal */}
        {showEditModal && selectedUserForEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-xl rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-emerald-600 text-white shadow-md">
                    <Pencil className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl  text-zinc-900">Edit User</h2>
                    <p className="text-sm text-zinc-500">{selectedUserForEdit.fullName}</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="rounded-2xl border border-zinc-200 p-2 text-zinc-600 transition hover:bg-zinc-50"
                  type="button"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Full Name</label>
                  <input
                    value={editForm.fullName}
                    onChange={(e) => setEditForm((p) => ({ ...p, fullName: e.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Email</label>
                  <input
                    value={editForm.email}
                    onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Mobile</label>
                  <input
                    value={editForm.mobile}
                    onChange={(e) =>
                      setEditForm((p) => ({ ...p, mobile: e.target.value.replace(/\D/g, "") }))
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-zinc-700">Status</label>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value as any }))}
                      className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-800 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
                    >
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                      <option value="deleted">Deleted</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-semibold text-zinc-700">
                      Role {isSuperAdmin ? "" : "(Super Admin only)"}
                    </label>
                    <select
                      value={editForm.role}
                      onChange={(e) => setEditForm((p) => ({ ...p, role: e.target.value as any }))}
                      disabled={!isSuperAdmin}
                      className={[
                        "w-full rounded-2xl border px-4 py-3 text-sm font-semibold focus:outline-none transition",
                        isSuperAdmin
                          ? "border-zinc-200 bg-zinc-50 text-zinc-800 focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20"
                          : "border-zinc-200 bg-zinc-100 text-zinc-400 cursor-not-allowed",
                      ].join(" ")}
                    >
                      <option value="user">User</option>
                      <option value="moderator">Moderator</option>
                      <option value="admin">Admin</option>
                      <option value="super_admin">Super Admin</option>
                    </select>
                  </div>
                </div>

                {isSelf(selectedUserForEdit._id) ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                    ℹ️ For safety, you cannot suspend/delete your own account.
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowEditModal(false)}
                  disabled={savingEdit}
                  className="rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={saveEdit}
                  disabled={savingEdit}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:from-sky-700 hover:to-emerald-700 hover:shadow-xl disabled:opacity-50"
                  type="button"
                >
                  {savingEdit ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Pencil className="h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Assign Referral Modal */}
        {showReferralModal && selectedUserForReferral && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-emerald-600 text-white shadow-md">
                    <UserPlus className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl  text-zinc-900">Assign Referral Parent</h2>
                    <p className="text-sm text-zinc-500">Link user to a referral parent</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowReferralModal(false)}
                  className="rounded-2xl border border-zinc-200 p-2 text-zinc-600 transition hover:bg-zinc-50"
                  type="button"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm">
                <p className="font-semibold text-amber-900">User Without Referral:</p>
                <p className="mt-1 text-amber-800">{selectedUserForReferral.fullName}</p>
                <p className="text-xs text-amber-700 mt-0.5">
                  {selectedUserForReferral.email || selectedUserForReferral.mobile}
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    Referral Code <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Enter referral code"
                    value={referralForm.referralCode}
                    onChange={(e) => setReferralForm({ ...referralForm, referralCode: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    Position (Optional)
                  </label>
                  <select
                    value={referralForm.position}
                    onChange={(e) =>
                      setReferralForm({ ...referralForm, position: e.target.value as "" | "left" | "right" })
                    }
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
                  >
                    <option value="">Auto-assign (Recommended)</option>
                    <option value="left">Left</option>
                    <option value="right">Right</option>
                  </select>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowReferralModal(false)}
                  disabled={assigningReferral}
                  className="rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={assignReferral}
                  disabled={assigningReferral}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:from-sky-700 hover:to-emerald-700 hover:shadow-xl disabled:opacity-50"
                  type="button"
                >
                  {assigningReferral ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      <UserPlus className="h-4 w-4" />
                      Assign Referral
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function UsersPageWrapper() {
  return (
    <Suspense fallback={<div className="p-6 text-sm font-semibold text-zinc-600">Loading...</div>}>
      <UsersPage />
    </Suspense>
  );
}

export default UsersPageWrapper;
