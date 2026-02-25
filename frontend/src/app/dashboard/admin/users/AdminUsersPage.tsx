"use client";

import { useEffect, useMemo, useRef, useState, Suspense, useCallback } from "react";
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
  Store,
  CheckCircle2,
  XCircle,
  Calendar,
  Package,
  KeyRound,
} from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { showSuccessToast, showErrorToast } from "@/lib/toast";

type SellerRequest = {
  id: string;
  name: string;
  email: string;
  requestedAt: string;
  status: string;
};

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
  referralCode?: string;
  createdAt: string;
  lastLoginAt?: string;
  lastLogoutAt?: string;
  parent?: {
    name: string;
    email: string;
    mobile: string;
  };
  serviceCount?: number;
}

type AdminUsersTab = "admins" | "users" | "seller_requests" | "sellers";

interface AdminService {
  _id: string;
  name: string;
  price: number;
  status: string;
  slug?: string;
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
 * Γ£à Admin can manage users (activate/suspend, edit user basic fields).
 * Γ£à Super admin can additionally: promote/demote roles, delete users.
 * Γ£à Prevent self-destruction (cannot suspend/delete yourself).
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

const TAB_TO_PATH: Record<AdminUsersTab, string> = {
  admins: "/dashboard/admin/users/admins",
  users: "/dashboard/admin/users/users",
  sellers: "/dashboard/admin/users/sellers",
  seller_requests: "/dashboard/admin/users/seller-requests",
};

function AdminUsersPage({ activeTab }: { activeTab: AdminUsersTab }) {
  const { user: currentUser } = useAuth({ requireAdmin: true });
  const searchParams = useSearchParams();

  const isSuperAdmin = (currentUser as any)?.role === "super_admin";
  const isAdmin = (currentUser as any)?.role === "admin" || isSuperAdmin;

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState<string | null>(null);
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

  // Seller requests (for Sellers tab)
  const [sellerRequests, setSellerRequests] = useState<SellerRequest[]>([]);
  const [sellerRequestsLoading, setSellerRequestsLoading] = useState(false);
  const [sellerRequestsPage, setSellerRequestsPage] = useState(1);
  const [sellerRequestsPagination, setSellerRequestsPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 1,
  });
  const [sellerActionId, setSellerActionId] = useState<string | null>(null);

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
    referralCode: "",
  });

  // Seller services modal (list services by seller)
  const [showSellerServicesModal, setShowSellerServicesModal] = useState(false);
  const [selectedSellerForServices, setSelectedSellerForServices] = useState<User | null>(null);
  const [sellerServicesList, setSellerServicesList] = useState<AdminService[]>([]);
  const [sellerServicesLoading, setSellerServicesLoading] = useState(false);

  // KYC reject modal
  const [showKycRejectModal, setShowKycRejectModal] = useState(false);
  const [kycRejectUserId, setKycRejectUserId] = useState<string | null>(null);
  const [kycRejectReason, setKycRejectReason] = useState("");
  const [kycRejecting, setKycRejecting] = useState(false);

  // Generate referral code loading
  const [generatingCodeId, setGeneratingCodeId] = useState<string | null>(null);

  // Row actions menu
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  const fetchSellerRequests = useCallback(async (pageNum = 1) => {
    setSellerRequestsLoading(true);
    try {
      const res = await fetch(
        `/api/requests/pending-sellers?page=${pageNum}&limit=10`,
        { credentials: "include" }
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load seller requests");
      setSellerRequests(json.data || []);
      setSellerRequestsPagination({
        page: json.pagination?.page ?? 1,
        limit: json.pagination?.limit ?? 10,
        total: json.pagination?.total ?? 0,
        totalPages: json.pagination?.totalPages ?? 1,
      });
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to load seller requests");
      setSellerRequests([]);
    } finally {
      setSellerRequestsLoading(false);
    }
  }, []);

  const handleApproveSeller = async (id: string) => {
    setSellerActionId(id);
    try {
      const res = await fetch(`/api/requests/approve/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to approve");
      showSuccessToast("Seller approved successfully");
      await fetchSellerRequests(sellerRequestsPage);
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to approve");
    } finally {
      setSellerActionId(null);
    }
  };

  const handleRejectSeller = async (id: string) => {
    setSellerActionId(id);
    try {
      const res = await fetch(`/api/requests/reject/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "Rejected by admin" }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to reject");
      showSuccessToast("Seller request rejected");
      await fetchSellerRequests(sellerRequestsPage);
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to reject");
    } finally {
      setSellerActionId(null);
    }
  };

  const loadSellerServices = useCallback(async (sellerId: string) => {
    setSellerServicesLoading(true);
    try {
      const res = await fetch(`/api/admin/services?sellerId=${sellerId}`, { credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to load services");
      setSellerServicesList(json.services || []);
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to load services");
      setSellerServicesList([]);
    } finally {
      setSellerServicesLoading(false);
    }
  }, []);

  const openSellerServices = (seller: User) => {
    setSelectedSellerForServices(seller);
    setShowSellerServicesModal(true);
    loadSellerServices(seller._id);
  };

  const handleKycApprove = async (userId: string) => {
    setMutating(userId);
    try {
      const res = await fetch(`/api/admin/kyc/${userId}/approve`, { method: "PUT", credentials: "include" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to approve KYC");
      showSuccessToast("KYC approved");
      await fetchUsers();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to approve KYC");
    } finally {
      setMutating(null);
    }
  };

  const handleKycRejectSubmit = async () => {
    if (!kycRejectUserId || !kycRejectReason.trim()) {
      showErrorToast("Please enter a rejection reason");
      return;
    }
    setKycRejecting(true);
    try {
      const res = await fetch(`/api/admin/kyc/${kycRejectUserId}/reject`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: kycRejectReason.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to reject KYC");
      showSuccessToast("KYC rejected");
      setShowKycRejectModal(false);
      setKycRejectUserId(null);
      setKycRejectReason("");
      await fetchUsers();
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to reject KYC");
    } finally {
      setKycRejecting(false);
    }
  };

  const handleGenerateReferralCode = async (userId: string) => {
    setGeneratingCodeId(userId);
    try {
      const res = await fetch(`/api/admin/users/${userId}/generate-referral-code`, {
        method: "POST",
        credentials: "include",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || "Failed to generate code");
      showSuccessToast(`Referral code: ${json.referralCode ?? ""}`);
      await fetchUsers();
      if (selectedUserForEdit?._id === userId) {
        setEditForm((p) => ({ ...p, referralCode: json.referralCode ?? "" }));
      }
    } catch (err) {
      showErrorToast(err instanceof Error ? err.message : "Failed to generate code");
    } finally {
      setGeneratingCodeId(null);
    }
  };

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
    if (activeTab === "seller_requests") {
      fetchSellerRequests(sellerRequestsPage);
    } else {
      fetchUsers();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, searchTerm, roleFilter, statusFilter, activeTab, sellerRequestsPage]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams({
        page: currentPage.toString(),
        limit: "10",
      });

      if (activeTab === "admins") {
        params.set("role", "super_admin,admin,moderator");
      } else if (activeTab === "users") {
        params.set("role", "user");
        if (searchTerm) params.set("search", searchTerm);
        if (statusFilter) params.set("status", statusFilter);
      } else if (activeTab === "sellers") {
        params.set("type", "sellers");
        if (searchTerm) params.set("search", searchTerm);
      } else {
        if (searchTerm) params.set("search", searchTerm);
        if (roleFilter) params.set("role", roleFilter);
        if (statusFilter) params.set("status", statusFilter);
      }

      const response = await fetch(`/api/admin/users?${params}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.error || data?.message || "Failed to fetch users");
      }

      const data: UsersResponse = await response.json();
      console.log("data", data);
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
      referralCode: u.referralCode || "",
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
          ...(editForm.referralCode?.trim() && { referralCode: editForm.referralCode.trim() }),
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
    if (!isAdmin) {
      showErrorToast("Admin permission required to assign referral parent.");
      return;
    }
    setSelectedUserForReferral(user);
    setReferralForm({ referralCode: "" });
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
      const response = await apiFetch(`/api/admin/users/${selectedUserForReferral._id}/referral`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          referralCode: referralForm.referralCode.trim(),
        }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        let errMsg = data?.error || data?.message || `Failed to assign referral (${response.status})`;
        if (data?.debug?.yourRole !== undefined) {
          errMsg += ` [Your role: ${data.debug.yourRole}]`;
        }
        throw new Error(errMsg);
      }

      showSuccessToast(data.message || "Referral assigned successfully");
      setShowReferralModal(false);
      setSelectedUserForReferral(null);
      setReferralForm({ referralCode: "" });
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

  if (loading && users.length === 0 && (activeTab === "users" || activeTab === "admins" || activeTab === "sellers")) {
    return (
      <div className="min-h-screen">
        <div className="h-1" />
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-9 w-64 rounded-lg bg-slate-200" />
            <div className="h-4 w-96 rounded-lg bg-slate-200" />
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-4 border-b border-slate-100 py-4 last:border-b-0"
                >
                  <div className="h-10 w-10 rounded-xl bg-slate-200" />
                  <div className="flex-1">
                    <div className="mb-2 h-4 w-1/4 rounded bg-slate-200" />
                    <div className="h-3 w-1/3 rounded bg-slate-200" />
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
    <div className="min-h-screen">
      <div className="h-1" />

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Users & Sellers
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage user accounts, roles, and seller applications.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700">
                <Shield className="h-3.5 w-3.5 text-emerald-600" />
                {(currentUser as any)?.role === "super_admin" ? "Super Admin" : (currentUser as any)?.role === "admin" ? "Admin" : "Moderator"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {(activeTab === "admins" || activeTab === "users" || activeTab === "sellers") && (
              <>
                <button
                  onClick={fetchUsers}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                  type="button"
                  title="Refresh list"
                >
                  <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
                  Refresh
                </button>
                {(activeTab === "admins" || activeTab === "users") && (
                  <button
                    onClick={() => {
                      if (!canUseCreate) return showErrorToast("You don't have permission to create users.");
                      setShowCreateModal(true);
                    }}
                    className={[
                      "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold shadow-sm transition",
                      canUseCreate
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white hover:opacity-95"
                        : "cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400",
                    ].join(" ")}
                    type="button"
                    disabled={!canUseCreate}
                    title={!canUseCreate ? "Only Admin/Super Admin can create users" : "Create user"}
                  >
                    <Plus className="h-4 w-4" />
                    Create User
                  </button>
                )}
              </>
            )}
            {activeTab === "seller_requests" && (
              <button
                onClick={() => fetchSellerRequests(sellerRequestsPage)}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                type="button"
                disabled={sellerRequestsLoading}
              >
                <RefreshCcw className={`h-4 w-4 ${sellerRequestsLoading ? "animate-spin" : ""}`} />
                Refresh
              </button>
            )}
            <Link
              href="/dashboard/admin"
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Admin
            </Link>
          </div>
        </div>

        {/* Tabs: Admins | Users | Seller requests | Sellers */}
        <div className="mb-6 flex flex-wrap gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
          <Link
            href={TAB_TO_PATH.admins}
            prefetch={false}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "admins" ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Shield className="h-4 w-4" />
            Admins
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {activeTab === "admins" ? pagination.total : "—"}
            </span>
          </Link>
          <Link
            href={TAB_TO_PATH.users}
            prefetch={false}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "users" ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Users className="h-4 w-4" />
            Users
            <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {activeTab === "users" ? pagination.total : "—"}
            </span>
          </Link>
          <Link
            href={TAB_TO_PATH.sellers}
            prefetch={false}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "sellers" ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Store className="h-4 w-4" />
            Sellers
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              {activeTab === "sellers" ? pagination.total : "—"}
            </span>
          </Link>
          <Link
            href={TAB_TO_PATH.seller_requests}
            prefetch={false}
            className={`inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium transition ${
              activeTab === "seller_requests" ? "bg-slate-100 text-slate-900 shadow-sm" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
            }`}
          >
            <Store className="h-4 w-4" />
            Seller requests
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
              {sellerRequestsPagination.total}
            </span>
          </Link>
        </div>

        {/* Error */}
        {error && (activeTab === "users" || activeTab === "admins" || activeTab === "sellers") ? (
          <div className="mb-6 rounded-xl border border-red-200 bg-white p-4 text-sm font-medium text-red-700 shadow-sm">
            {error}
          </div>
        ) : null}

        {/* Tab: Seller requests (pending) */}
        {activeTab === "seller_requests" ? (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Pending seller applications</h2>
              <p className="mt-0.5 text-sm text-slate-600">Approve or reject users who requested to become sellers.</p>
            </div>
            {sellerRequestsLoading && sellerRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-200 border-t-emerald-600" />
                <p className="mt-4 text-sm text-slate-600">Loading seller requestsΓÇª</p>
              </div>
            ) : sellerRequests.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Store className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No pending requests</h3>
                <p className="mt-1 text-sm text-slate-500">New seller applications will appear here.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Applicant</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Email</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Requested</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sellerRequests.map((req) => (
                        <tr key={req.id} className="transition hover:bg-slate-50/80">
                          <td className="px-6 py-4 font-medium text-slate-900">{req.name || "ΓÇö"}</td>
                          <td className="px-6 py-4 text-slate-700">{req.email || "ΓÇö"}</td>
                          <td className="px-6 py-4 text-slate-600">
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="h-4 w-4 text-slate-400" />
                              {new Date(req.requestedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => handleApproveSeller(req.id)}
                                disabled={sellerActionId === req.id}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-medium text-emerald-800 transition hover:bg-emerald-100 disabled:opacity-60"
                              >
                                {sellerActionId === req.id ? (
                                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-600 border-t-transparent" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectSeller(req.id)}
                                disabled={sellerActionId === req.id}
                                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                              >
                                <XCircle className="h-4 w-4" />
                                Reject
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sellerRequestsPagination.totalPages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-3">
                    <p className="text-sm text-slate-600">
                      Showing {(sellerRequestsPagination.page - 1) * sellerRequestsPagination.limit + 1}ΓÇô{Math.min(sellerRequestsPagination.page * sellerRequestsPagination.limit, sellerRequestsPagination.total)} of {sellerRequestsPagination.total}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setSellerRequestsPage((p) => Math.max(1, p - 1))}
                        disabled={sellerRequestsPage === 1}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="flex items-center px-3 py-1.5 text-sm text-slate-600">
                        Page {sellerRequestsPage} of {sellerRequestsPagination.totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSellerRequestsPage((p) => Math.min(sellerRequestsPagination.totalPages, p + 1))}
                        disabled={sellerRequestsPage >= sellerRequestsPagination.totalPages}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : activeTab === "sellers" ? (
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/80 px-6 py-4">
              <h2 className="text-base font-semibold text-slate-900">Approved sellers</h2>
              <p className="mt-0.5 text-sm text-slate-600">View services posted by each seller. Click to list and manage.</p>
            </div>
            {users.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Store className="h-12 w-12 text-slate-300" />
                <h3 className="mt-4 text-lg font-semibold text-slate-900">No sellers yet</h3>
                <p className="mt-1 text-sm text-slate-500">Approved sellers will appear here.</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b border-slate-200 bg-slate-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Seller</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Contact</th>
                        <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Services</th>
                        <th className="px-6 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {users.map((seller) => (
                        <tr key={seller._id} className="transition hover:bg-slate-50/80">
                          <td className="px-6 py-4 font-medium text-slate-900">{seller.fullName || seller.name || "ΓÇö"}</td>
                          <td className="px-6 py-4 text-slate-700">
                            <div>{seller.email || "ΓÇö"}</div>
                            <div className="text-xs text-slate-500">{seller.mobile || ""}</div>
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                              {(seller as User & { serviceCount?: number }).serviceCount ?? 0} services
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button
                              type="button"
                              onClick={() => openSellerServices(seller)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                            >
                              <Package className="h-4 w-4" />
                              View services
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {pagination.pages > 1 && (
                  <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50/80 px-6 py-3">
                    <p className="text-sm text-slate-600">
                      Showing {(pagination.page - 1) * pagination.limit + 1}ΓÇô{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="flex items-center px-3 py-1.5 text-sm text-slate-600">
                        Page {currentPage} of {pagination.pages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setCurrentPage((p) => Math.min(pagination.pages, p + 1))}
                        disabled={currentPage >= pagination.pages}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : (
          <>
            {/* Filters - Admins / Users tab */}
            <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="grid gap-4 sm:grid-cols-[1fr_200px_200px]">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search by name, email, mobile..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 !pl-10 pr-4 text-sm text-slate-900 placeholder-slate-500 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-2 focus:ring-emerald-500/20"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">All roles</option>
                  <option value="super_admin">Super Admin</option>
                  <option value="admin">Admin</option>
                  <option value="moderator">Moderator</option>
                  <option value="user">User</option>
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm font-medium text-slate-800 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                >
                  <option value="">All status</option>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="deleted">Deleted</option>
                </select>
              </div>
              {!isSuperAdmin && (
                <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs font-medium text-amber-800">
                  Admins can manage only Users and Moderators. Only Super Admin can change roles or delete users.
                </div>
              )}
            </div>

            {/* Users/Admins Table */}
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">User</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Contact</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Referral code</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Role</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Activity / Account</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">KYC</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {users.map((u) => {
                  const rowBusy = mutating === u._id;

                  return (
                    <tr
                      key={u._id}
                      className={[
                        "transition-colors",
                        !u.parent && u.role === "user" ? "bg-amber-50/50 hover:bg-amber-100/50" : "hover:bg-slate-50/80",
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
                                No referral parent
                              </div>
                            ) : null}
                            {isSelf(u._id) ? (
                              <div className="mt-1 text-xs font-bold text-sky-700">You</div>
                            ) : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="text-sm text-zinc-900">{u.email || "ΓÇö"}</div>
                        <div className="text-sm text-zinc-500">{u.mobile || "ΓÇö"}</div>
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex flex-wrap items-center gap-2">
                          {u.referralCode ? (
                            <code className="rounded bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-800">
                              {u.referralCode}
                            </code>
                          ) : (
                            <span className="text-xs text-slate-500">ΓÇö</span>
                          )}
                          {/* <button
                            type="button"
                            onClick={() => handleGenerateReferralCode(u._id)}
                            disabled={generatingCodeId === u._id}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                            title="Generate referral code"
                          >
                            {generatingCodeId === u._id ? (
                              <span className="h-3 w-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                            ) : (
                              <KeyRound className="h-3.5 w-3.5" />
                            )}
                            {u.referralCode ? "Regen" : "Generate"}
                          </button> */}
                        </div>
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
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={[
                              "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs",
                              getKycBadgeColor(u.kycStatus),
                            ].join(" ")}
                          >
                            {u.kycStatus.replace("_", " ").toUpperCase()}
                          </span>
                          {(u.kycStatus === "pending" || u.kycStatus === "submitted") && (
                            <>
                              {/* <button
                                type="button"
                                onClick={() => handleKycApprove(u._id)}
                                disabled={rowBusy}
                                className="inline-flex items-center gap-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700 transition hover:bg-emerald-100 disabled:opacity-60"
                                title="Approve KYC"
                              >
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Approve
                              </button> */}
                              {/* <button
                                type="button"
                                onClick={() => {
                                  setKycRejectUserId(u._id);
                                  setKycRejectReason("");
                                  setShowKycRejectModal(true);
                                }}
                                disabled={rowBusy}
                                className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2 py-1 text-xs font-medium text-red-700 transition hover:bg-red-100 disabled:opacity-60"
                                title="Reject KYC"
                              >
                                <XCircle className="h-3.5 w-3.5" />
                                Reject
                              </button> */}
                            </>
                          )}
                        </div>
                      </td>

                      <td className="px-6 py-4 align-top text-sm text-zinc-500">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>

                      <td className="px-6 py-4 align-top">
                        <div className="flex items-center gap-2">
                          {/* Assign referral (admin/super_admin when user has no parent) */}
                          {!u.parent && u.role === "user" && isAdmin ? (
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
          <div className="border-t border-slate-200 bg-slate-50 px-6 py-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-600">
                Showing{" "}
                <span className="font-medium">
                  {pagination.total === 0 ? 0 : (currentPage - 1) * pagination.limit + 1}
                </span>{" "}
                to{" "}
                <span className="font-medium">
                  {Math.min(currentPage * pagination.limit, pagination.total)}
                </span>{" "}
                of <span className="font-medium">{pagination.total}</span> results
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  type="button"
                >
                  Previous
                </button>

                <span className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700">
                  Page <span className="font-semibold">{currentPage}</span> of{" "}
                  <span className="font-semibold">{pagination.pages || 1}</span>
                </span>

                <button
                  onClick={() => setCurrentPage(Math.min(pagination.pages || 1, currentPage + 1))}
                  disabled={currentPage === (pagination.pages || 1)}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
                  type="button"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
            </div>
          </>
        )}

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
                      Γä╣∩╕Å Admin can create only User/Moderator. (Super Admin required for Admin/Super Admin)
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

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">Referral code</label>
                  <div className="flex gap-2">
                    <input
                      value={editForm.referralCode}
                      onChange={(e) => setEditForm((p) => ({ ...p, referralCode: e.target.value }))}
                      placeholder="Optional ΓÇö assign or edit"
                      className="flex-1 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
                    />
                    <button
                      type="button"
                      onClick={() => selectedUserForEdit && handleGenerateReferralCode(selectedUserForEdit._id)}
                      disabled={generatingCodeId === selectedUserForEdit._id}
                      className="inline-flex items-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
                      title="Generate unique referral code"
                    >
                      {generatingCodeId === selectedUserForEdit._id ? (
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-sky-300 border-t-sky-600" />
                      ) : (
                        <KeyRound className="h-4 w-4" />
                      )}
                      Generate
                    </button>
                  </div>
                </div>

                {isSelf(selectedUserForEdit._id) ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-800">
                    Γä╣∩╕Å For safety, you cannot suspend/delete your own account.
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

        {/* KYC Reject Modal */}
        {showKycRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-bold text-zinc-900">Reject KYC</h2>
                <button
                  type="button"
                  onClick={() => {
                    setShowKycRejectModal(false);
                    setKycRejectUserId(null);
                    setKycRejectReason("");
                  }}
                  className="rounded-2xl border border-zinc-200 p-2 text-zinc-600 transition hover:bg-zinc-50"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <p className="mb-4 text-sm text-zinc-600">Please provide a reason for rejecting this KYC submission.</p>
              <div className="mb-4">
                <label className="mb-2 block text-sm font-semibold text-zinc-700">Reason (required)</label>
                <textarea
                  value={kycRejectReason}
                  onChange={(e) => setKycRejectReason(e.target.value)}
                  placeholder="e.g. Document unclear, mismatch with details..."
                  rows={3}
                  className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowKycRejectModal(false);
                    setKycRejectUserId(null);
                    setKycRejectReason("");
                  }}
                  disabled={kycRejecting}
                  className="rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleKycRejectSubmit}
                  disabled={kycRejecting || !kycRejectReason.trim()}
                  className="inline-flex items-center gap-2 rounded-2xl bg-red-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-700 disabled:opacity-50"
                >
                  {kycRejecting ? (
                    <>
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      Rejecting...
                    </>
                  ) : (
                    "Reject KYC"
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

        {/* Seller services modal */}
        {showSellerServicesModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl max-h-[85vh] flex flex-col rounded-3xl border border-zinc-200 bg-white shadow-xl">
              <div className="flex items-center justify-between p-6 border-b border-zinc-200">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-600">
                    <Package className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-zinc-900">Seller services</h2>
                    <p className="text-sm text-zinc-500">
                      {selectedSellerForServices?.fullName || selectedSellerForServices?.name} ΓÇö {selectedSellerForServices?.email || selectedSellerForServices?.mobile}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setShowSellerServicesModal(false);
                    setSelectedSellerForServices(null);
                    setSellerServicesList([]);
                  }}
                  className="rounded-2xl border border-zinc-200 p-2 text-zinc-600 transition hover:bg-zinc-50"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex-1 overflow-auto p-6">
                {sellerServicesLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <span className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-600" />
                  </div>
                ) : sellerServicesList.length === 0 ? (
                  <p className="text-center text-sm text-zinc-500 py-8">No services posted by this seller.</p>
                ) : (
                  <div className="space-y-2">
                    {sellerServicesList.map((svc) => (
                      <div
                        key={svc._id}
                        className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-zinc-50/50 px-4 py-3"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-zinc-900 truncate">{svc.name}</p>
                          <p className="text-xs text-zinc-500">
                            Γé╣{typeof svc.price === "number" ? svc.price.toLocaleString() : svc.price} ┬╖ {String(svc.status)}
                          </p>
                        </div>
                        <Link
                          href={`/dashboard/admin/services?highlight=${svc._id}`}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-medium text-sky-700 transition hover:bg-sky-100"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Link>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default AdminUsersPage;
