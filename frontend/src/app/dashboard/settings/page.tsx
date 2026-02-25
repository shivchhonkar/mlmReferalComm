"use client";

import { useState, useEffect } from "react";
import { Settings, Bell, Lock, Eye, Database, X, Mail, KeyRound, ChevronRight, Loader2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { apiFetch } from "@/lib/apiClient";
import { showSuccessToast, showErrorToast } from "@/lib/toast";
import { useAuth } from "@/lib/useAuth";

export default function SettingsPage() {
  const { loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<"account" | "notifications" | "privacy" | "data">("account");
  const [userEmail, setUserEmail] = useState<string>("Loading...");
  const [loading, setLoading] = useState(false);
  
  // Modal states
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  // Password form
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  // Email form
  const [emailForm, setEmailForm] = useState({
    newEmail: "",
    password: "",
  });
  
  const [settings, setSettings] = useState({
    emailNotifications: true,
    pushNotifications: false,
    smsNotifications: true,
    marketingEmails: true,
    twoFactorAuth: false,
    privateProfile: false,
    dataCollection: true,
    analyticsData: true,
  });

  // Fetch user email
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const res = await apiFetch("/api/me");
        const data = await res.json();
        if (data.user?.email) {
          setUserEmail(data.user.email);
        }
      } catch (error) {
        console.error("Failed to fetch user data:", error);
        setUserEmail("Not available");
      }
    };
    fetchUserData();
  }, []);

  const handleToggle = (key: keyof typeof settings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleChangePassword = async () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      showErrorToast("All fields are required");
      return;
    }
    
    if (passwordForm.newPassword.length < 8) {
      showErrorToast("New password must be at least 8 characters");
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showErrorToast("New passwords do not match");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/profile/change-password", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: passwordForm.currentPassword,
          newPassword: passwordForm.newPassword,
          confirmPassword: passwordForm.confirmPassword,
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        console.error("Failed to parse response:", parseError);
        throw new Error("Server returned invalid response");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to change password");
      }

      showSuccessToast(data?.message || "Password changed successfully");
      setShowPasswordModal(false);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
    } catch (error) {
      console.error("Password change error:", error);
      showErrorToast(error instanceof Error ? error.message : "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  const handleChangeEmail = async () => {
    if (!emailForm.newEmail || !emailForm.password) {
      showErrorToast("All fields are required");
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailForm.newEmail)) {
      showErrorToast("Invalid email format");
      return;
    }

    setLoading(true);
    try {
      const res = await apiFetch("/api/profile/change-email", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newEmail: emailForm.newEmail,
          password: emailForm.password,
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch (parseError) {
        console.error("Failed to parse response:", parseError);
        throw new Error("Server returned invalid response");
      }

      if (!res.ok) {
        throw new Error(data?.error || "Failed to change email");
      }

      showSuccessToast(data?.message || "Email changed successfully");
      setUserEmail(data?.email || emailForm.newEmail);
      setShowEmailModal(false);
      setEmailForm({ newEmail: "", password: "" });
    } catch (error) {
      console.error("Email change error:", error);
      showErrorToast(error instanceof Error ? error.message : "Failed to change email");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="animate-pulse space-y-6">
            <div className="h-8 w-48 rounded-lg bg-slate-200" />
            <div className="grid gap-6 md:grid-cols-4">
              <div className="h-64 rounded-2xl bg-slate-200" />
              <div className="md:col-span-3 h-96 rounded-2xl bg-slate-200" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  const settingTabs = [
    { id: "account", label: "Account", icon: Lock },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "privacy", label: "Privacy", icon: Eye },
    { id: "data", label: "Data", icon: Database },
  ] as const;

  const Toggle = ({
    checked,
    onClick,
  }: {
    checked: boolean;
    onClick: () => void;
  }) => (
    <button
      onClick={onClick}
      type="button"
      className={[
        "relative inline-flex h-6 w-14 items-center rounded-full transition-colors",
        checked ? "bg-gradient-to-r from-emerald-600 to-sky-600" : "bg-zinc-300",
      ].join(" ")}
      aria-pressed={checked}
    >
      <span
        className={[
          "inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-7" : "translate-x-1",
        ].join(" ")}
      />
    </button>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-600">
          <Link href="/dashboard" className="hover:text-emerald-600 transition">Dashboard</Link>
          <ChevronRight className="h-4 w-4 text-slate-400" />
          <span className="font-medium text-slate-900">Settings</span>
        </nav>

        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">Settings</h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage your account, notifications, and privacy
            </p>
          </div>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50/50"
          >
            Back to Dashboard
          </Link>
        </div>

        {/* Settings Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Sidebar */}
          <div className="lg:col-span-1 lg:sticky lg:top-6 lg:self-start">
            <nav className="rounded-2xl border border-slate-200 bg-white p-1 shadow-sm" aria-label="Settings sections">
              {settingTabs.map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    type="button"
                    className={[
                      "w-full flex items-center gap-3 rounded-xl px-4 py-3 text-left transition",
                      active
                        ? "bg-emerald-50 text-emerald-800 shadow-sm"
                        : "text-slate-600 hover:bg-slate-50 hover:text-slate-900",
                    ].join(" ")}
                  >
                    <span className={[
                      "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                      active ? "bg-emerald-100 text-emerald-600" : "bg-slate-100 text-slate-500",
                    ].join(" ")}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1 text-left">
                      <div className="text-sm font-semibold">{tab.label}</div>
                      <div className="text-xs text-slate-500">
                        {tab.id === "account" ? "Security & access" : tab.id === "notifications" ? "Email & alerts" : tab.id === "privacy" ? "Visibility" : "Data & export"}
                      </div>
                    </div>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          <div className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              {/* Account */}
              {activeTab === "account" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Account & Security</h2>
                    <p className="mt-1 text-sm text-slate-500">Update password, email, and 2FA.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition hover:bg-white">
                      <div>
                        <h3 className="font-semibold text-slate-900">Two-Factor Authentication</h3>
                        <p className="mt-1 text-sm text-slate-500">Add an extra layer of security</p>
                      </div>
                      <Toggle checked={settings.twoFactorAuth} onClick={() => handleToggle("twoFactorAuth")} />
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      <h3 className="font-semibold text-slate-900">Change Password</h3>
                      <p className="mt-1 text-sm text-slate-500 mb-3">Update your account password periodically.</p>
                      <button
                        type="button"
                        onClick={() => setShowPasswordModal(true)}
                        className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-700 hover:to-teal-700"
                      >
                        <KeyRound className="h-4 w-4" />
                        Update Password
                      </button>
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      <h3 className="font-semibold text-slate-900">Email Address</h3>
                      <p className="mt-1 text-sm text-slate-600 mb-3">{userEmail}</p>
                      <button
                        type="button"
                        onClick={() => setShowEmailModal(true)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/50"
                      >
                        <Mail className="h-4 w-4" />
                        Change Email
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Notifications */}
              {activeTab === "notifications" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Notification Preferences</h2>
                    <p className="mt-1 text-sm text-slate-500">Choose what you want to receive and where.</p>
                  </div>

                  <div className="space-y-4">
                    {[
                      {
                        key: "emailNotifications" as const,
                        title: "Email Notifications",
                        desc: "Receive updates via email",
                      },
                      {
                        key: "pushNotifications" as const,
                        title: "Push Notifications",
                        desc: "Get notifications on your device",
                      },
                      {
                        key: "smsNotifications" as const,
                        title: "SMS Notifications",
                        desc: "Receive SMS messages",
                      },
                      {
                        key: "marketingEmails" as const,
                        title: "Marketing Emails",
                        desc: "Receive promotional content",
                      },
                    ].map((item) => (
                      <div
                        key={item.key}
                        className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition hover:bg-white"
                      >
                        <div>
                          <h3 className="font-semibold text-slate-900">{item.title}</h3>
                          <p className="mt-1 text-sm text-slate-500">{item.desc}</p>
                        </div>
                        <Toggle
                          checked={settings[item.key]}
                          onClick={() => handleToggle(item.key)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Privacy */}
              {activeTab === "privacy" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Privacy Settings</h2>
                    <p className="mt-1 text-sm text-slate-500">Control what others can see.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition hover:bg-white">
                      <div>
                        <h3 className="font-semibold text-slate-900">Private Profile</h3>
                        <p className="mt-1 text-sm text-slate-500">Only show your profile to connections</p>
                      </div>
                      <Toggle checked={settings.privateProfile} onClick={() => handleToggle("privateProfile")} />
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      <h3 className="font-semibold text-slate-900">Blocked Users</h3>
                      <p className="mt-1 text-sm text-slate-500 mb-3">Manage users you have blocked.</p>
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
                      >
                        Manage Blocked Users
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Data */}
              {activeTab === "data" && (
                <div className="space-y-8">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">Data & Privacy</h2>
                    <p className="mt-1 text-sm text-slate-500">Manage how data is collected and exported.</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition hover:bg-white">
                      <div>
                        <h3 className="font-semibold text-slate-900">Data Collection</h3>
                        <p className="mt-1 text-sm text-slate-500">Allow us to collect usage data</p>
                      </div>
                      <Toggle checked={settings.dataCollection} onClick={() => handleToggle("dataCollection")} />
                    </div>

                    <div className="flex items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 transition hover:bg-white">
                      <div>
                        <h3 className="font-semibold text-slate-900">Analytics Data</h3>
                        <p className="mt-1 text-sm text-slate-500">Help us improve with analytics</p>
                      </div>
                      <Toggle checked={settings.analyticsData} onClick={() => handleToggle("analyticsData")} />
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      <h3 className="font-semibold text-slate-900">Export Your Data</h3>
                      <p className="mt-1 text-sm text-slate-500 mb-3">Download all your personal data in JSON format.</p>
                      <button
                        type="button"
                        className="rounded-xl border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 shadow-sm transition hover:border-sky-300 hover:bg-sky-50/50"
                      >
                        Download Data
                      </button>
                    </div>

                    <div className="border-t border-slate-200 pt-6">
                      <h3 className="font-semibold text-slate-900">Delete Account</h3>
                      <p className="mt-1 text-sm text-slate-500 mb-3">
                        Permanently delete your account and all associated data. This cannot be undone.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowDeleteConfirm(true)}
                        className="rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                      >
                        Delete Account
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Save - only show for tabs with toggles */}
              {activeTab !== "account" && (
                <div className="mt-10 border-t border-slate-200 pt-8">
                  <button
                    type="button"
                    className="rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:from-emerald-700 hover:to-teal-700"
                  >
                    Save Preferences
                  </button>
                  <p className="mt-2 text-xs text-slate-500">
                    These toggles are UI-only. Connect APIs to persist.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Change Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-600 to-sky-600 text-white shadow-md">
                    <Lock className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl  text-zinc-900">Change Password</h2>
                    <p className="text-sm text-zinc-500">Update your account password</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowPasswordModal(false)}
                  className="rounded-2xl border border-zinc-200 p-2 text-zinc-600 transition hover:bg-zinc-50"
                  type="button"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    Current Password <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    New Password <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Minimum 8 characters"
                    value={passwordForm.newPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    Confirm New Password <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Re-enter new password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                  {passwordForm.confirmPassword && passwordForm.newPassword !== passwordForm.confirmPassword && (
                    <p className="mt-1.5 text-xs text-red-600">Passwords do not match</p>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowPasswordModal(false)}
                  disabled={loading}
                  className="rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangePassword}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:from-emerald-700 hover:to-sky-700 hover:shadow-xl disabled:opacity-50"
                  type="button"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <KeyRound className="h-4 w-4" />
                      Update Password
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Email Modal */}
        {showEmailModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-zinc-200 bg-white p-6 shadow-xl">
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-600 to-emerald-600 text-white shadow-md">
                    <Mail className="h-6 w-6" />
                  </div>
                  <div>
                    <h2 className="text-xl  text-zinc-900">Change Email</h2>
                    <p className="text-sm text-zinc-500">Update your email address</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowEmailModal(false)}
                  className="rounded-2xl border border-zinc-200 p-2 text-zinc-600 transition hover:bg-zinc-50"
                  type="button"
                  title="Close"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                <p className="font-semibold">Current Email:</p>
                <p className="mt-1">{userEmail}</p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    New Email Address <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="email"
                    placeholder="user@example.com"
                    value={emailForm.newEmail}
                    onChange={(e) => setEmailForm({ ...emailForm, newEmail: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-sky-400 focus:ring-2 focus:ring-sky-500/20 transition"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-zinc-700">
                    Confirm Password <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="password"
                    placeholder="Enter your password"
                    value={emailForm.password}
                    onChange={(e) => setEmailForm({ ...emailForm, password: e.target.value })}
                    className="w-full rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-900 placeholder:text-zinc-500 focus:outline-none focus:bg-white focus:border-emerald-400 focus:ring-2 focus:ring-emerald-500/20 transition"
                  />
                  <p className="mt-1.5 text-xs text-zinc-500">Enter your password to confirm this change</p>
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowEmailModal(false)}
                  disabled={loading}
                  className="rounded-2xl border border-zinc-200 bg-white px-5 py-2.5 text-sm font-bold text-zinc-800 transition hover:bg-zinc-50 disabled:opacity-50"
                  type="button"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangeEmail}
                  disabled={loading}
                  className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-sky-600 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg transition hover:from-sky-700 hover:to-emerald-700 hover:shadow-xl disabled:opacity-50"
                  type="button"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    <>
                      <Mail className="h-4 w-4" />
                      Change Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Account Confirmation */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="delete-title">
            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600">
                  <AlertTriangle className="h-6 w-6" />
                </div>
                <div>
                  <h2 id="delete-title" className="text-lg font-semibold text-slate-900">Delete Account</h2>
                  <p className="mt-2 text-sm text-slate-600">
                    This will permanently delete your account and all data. This action cannot be undone.
                  </p>
                </div>
              </div>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  type="button"
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700"
                  onClick={() => {
                    showErrorToast("Delete account API not implemented");
                    setShowDeleteConfirm(false);
                  }}
                >
                  Delete Account
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
