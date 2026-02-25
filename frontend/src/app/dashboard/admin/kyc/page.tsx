"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { FileCheck, CheckCircle, XCircle, Clock, Eye, User, Calendar, MapPin, Briefcase, CreditCard, RefreshCw, Phone } from "lucide-react";

interface KYCUser {
  _id: string;
  fullName?: string;
  fatherName?: string;
  email?: string;
  mobile?: string;
  address?: string;
  dob?: string;
  occupation?: string;
  incomeSlab?: string;
  profileImage?: string;
  panNumber?: string;
  panDocument?: string;
  aadhaarNumber?: string;
  aadhaarDocument?: string;
  bankAccountName?: string;
  bankAccountNumber?: string;
  bankName?: string;
  bankAddress?: string;
  bankIfsc?: string;
  bankDocument?: string;
  nominees?: Array<{
    relation: string;
    name: string;
    dob: string;
    mobile: string;
  }>;
  kycStatus: "pending" | "submitted" | "verified" | "rejected";
  kycSubmittedAt?: string;
  kycVerifiedAt?: string;
  kycRejectedAt?: string;
  kycRejectionReason?: string;
}

type TabStatus = "submitted" | "verified" | "rejected" | "pending" | "all";

interface KYCResponse {
  users: KYCUser[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

interface KYCCounts {
  submitted: number;
  verified: number;
  rejected: number;
  pending: number;
  total: number;
}

const TABS: { value: TabStatus; label: string }[] = [
  { value: "submitted", label: "Pending Review" },
  { value: "verified", label: "Approved" },
  { value: "rejected", label: "Rejected" },
  { value: "pending", label: "Pending" },
  { value: "all", label: "All" },
];

export default function KYCPage() {
  useAuth({ requireAdmin: true });
  const [activeTab, setActiveTab] = useState<TabStatus>("submitted");
  const [users, setUsers] = useState<KYCUser[]>([]);
  const [counts, setCounts] = useState<KYCCounts | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<KYCUser | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    pages: 0
  });

  useEffect(() => {
    fetchKYCCounts();
  }, []);

  useEffect(() => {
    fetchKYCList();
  }, [activeTab, currentPage]);

  const fetchKYCCounts = async () => {
    try {
      const res = await fetch("/api/admin/kyc/counts", { credentials: "include" });
      if (res.ok) {
        const data: KYCCounts = await res.json();
        setCounts(data);
      }
    } catch {
      // Ignore
    }
  };

  const fetchKYCList = async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({
        status: activeTab,
        page: currentPage.toString(),
        limit: "10"
      });

      const response = await fetch(`/api/admin/kyc/list?${params}`, { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch KYC list");
      }
      const data: KYCResponse = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const approveKYC = async (userId: string) => {
    try {
      setActionLoading(userId);
      const response = await fetch(`/api/admin/kyc/${userId}/approve`, {
        method: "PUT",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to approve KYC");
      }

      await Promise.all([fetchKYCList(), fetchKYCCounts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const rejectKYC = async (userId: string, reason: string) => {
    try {
      setActionLoading(userId);
      const response = await fetch(`/api/admin/kyc/${userId}/reject`, {
        method: "PUT",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });

      if (!response.ok) {
        throw new Error("Failed to reject KYC");
      }

      setShowRejectModal(false);
      setSelectedUser(null);
      setRejectionReason("");
      await Promise.all([fetchKYCList(), fetchKYCCounts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const requestResubmission = async (userId: string) => {
    try {
      setActionLoading(userId);
      const response = await fetch(`/api/admin/kyc/${userId}/request-resubmission`, {
        method: "PUT",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error("Failed to request resubmission");
      }

      await Promise.all([fetchKYCList(), fetchKYCCounts()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "verified":
        return "bg-green-100 text-green-800";
      case "submitted":
        return "bg-yellow-100 text-yellow-800";
      case "rejected":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="h-20 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">KYC Management</h1>
        <p className="text-lg text-gray-600">
          Review and approve user Know Your Customer (KYC) submissions
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-600">{error}</p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-200">
        <nav className="-mb-px flex flex-wrap gap-2">
          {TABS.map((tab) => {
            const count = counts ? counts[tab.value as keyof KYCCounts] ?? 0 : 0;
            const isActive = activeTab === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => {
                  setActiveTab(tab.value);
                  setCurrentPage(1);
                }}
                className={`inline-flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors hover:cursor-pointer ${
                  isActive
                    ? "border-blue-600 text-blue-600"
                    : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
                }`}
              >
                {tab.label}
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium hover:cursor-pointer ${
                  isActive ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
                }`}>
                  {typeof count === "number" ? count : 0}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* KYC Applications */}
      {users.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <FileCheck className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {activeTab === "submitted" && "No KYC applications pending review"}
            {activeTab === "verified" && "No approved KYC records"}
            {activeTab === "rejected" && "No rejected KYC records"}
            {activeTab === "pending" && "No pending KYC submissions"}
            {activeTab === "all" && "No KYC records found"}
          </h3>
          <p className="text-gray-500">
            {activeTab === "submitted" && "All KYC applications have been reviewed. Great job!"}
            {activeTab === "verified" && "Approved KYCs will appear here."}
            {activeTab === "rejected" && "Rejected KYCs will appear here."}
            {activeTab === "pending" && "Users who haven't submitted KYC will appear here."}
            {activeTab === "all" && "No KYC submissions in the system."}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {users.map((user) => (
              <div key={user._id} className="bg-white rounded-lg border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                {/* User Header */}
                <div className="bg-gradient-to-r from-blue-50 to-gray-50 p-6">
                  <div className="flex items-center justify-between mb-4 relative">
                    <div className="flex items-center">
                      {user.profileImage ? (
                        <img
                          src={user.profileImage}
                          alt={user.fullName}
                          className="w-12 h-12 rounded-full object-cover mr-3"
                        />
                      ) : (
                        <div className="w-12 h-12 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                          <User className="w-6 h-6 text-gray-400" />
                        </div>
                      )}
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{user.fullName || user.email || "—"}</h3>
                        <p className="text-sm text-gray-600">{user.email || user.mobile || "—"}</p>
                      </div>
                    </div>
                    <span
                      className={`absolute bottom-11 right-1 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusBadgeColor(user.kycStatus)}`}
                    >
                      {user.kycStatus.replace("_", " ").toUpperCase()}
                    </span>
                  </div>
                </div>

                {/* KYC Details */}
                <div className="p-6">
                  <div className="space-y-3 mb-6">
                    {user.mobile && (
                      <div className="flex items-center text-sm">
                        <Phone className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600">{user.mobile}</span>
                      </div>
                    )}
                    {user.dob && (
                      <div className="flex items-center text-sm">
                        <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600">DOB: {new Date(user.dob).toLocaleDateString()}</span>
                      </div>
                    )}
                    {user.occupation && (
                      <div className="flex items-center text-sm">
                        <Briefcase className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600">{user.occupation}</span>
                      </div>
                    )}
                    {user.address && (
                      <div className="flex items-center text-sm">
                        <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600 line-clamp-1">{user.address}</span>
                      </div>
                    )}
                    {user.panNumber && (
                      <div className="flex items-center text-sm">
                        <CreditCard className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600">PAN: {user.panNumber}</span>
                      </div>
                    )}
                    {user.aadhaarNumber && (
                      <div className="flex items-center text-sm">
                        <CreditCard className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-gray-600">Aadhaar: {user.aadhaarNumber}</span>
                      </div>
                    )}
                  </div>

                  {/* Nominees */}
                  {user.nominees && user.nominees.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-sm font-medium text-gray-900 mb-2">Nominees</h4>
                      <div className="space-y-1">
                        {(user.nominees || []).slice(0, 2).map((nominee, index) => (
                          <div key={index} className="text-xs text-gray-600">
                            {nominee.name} ({nominee.relation})
                          </div>
                        ))}
                        {(user.nominees?.length ?? 0) > 2 && (
                          <div className="text-xs text-gray-500">
                            +{(user.nominees?.length ?? 0) - 2} more
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dates */}
                  <div className="text-xs text-gray-500 mb-4 space-y-0.5">
                    {user.kycSubmittedAt && (
                      <div>Submitted: {new Date(user.kycSubmittedAt).toLocaleDateString()}</div>
                    )}
                    {user.kycVerifiedAt && (
                      <div>Verified: {new Date(user.kycVerifiedAt).toLocaleDateString()}</div>
                    )}
                    {user.kycRejectedAt && (
                      <div>Rejected: {new Date(user.kycRejectedAt).toLocaleDateString()}</div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex items-center flex-wrap gap-2">
                    <button
                      onClick={() => {
                        setSelectedUser(user);
                        setShowDetailsModal(true);
                      }}
                      className="flex-1 min-w-[100px] flex items-center justify-center px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-lg hover:bg-gray-200 transition-colors hover:cursor-pointer"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </button>
                    {user.kycStatus === "verified" && (
                      <button
                        onClick={() => requestResubmission(user._id)}
                        disabled={actionLoading === user._id}
                        className="flex-1 min-w-[140px] flex items-center justify-center px-3 py-2 bg-amber-600 text-white text-sm rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50 hover:cursor-pointer"
                      >
                        {actionLoading === user._id ? (
                          <span className="animate-spin">⟳</span>
                        ) : (
                          <>
                            <RefreshCw className="w-4 h-4 mr-1" />
                            Request Resubmission
                          </>
                        )}
                      </button>
                    )}
                    {user.kycStatus === "submitted" && (
                      <>
                        <button
                          onClick={() => approveKYC(user._id)}
                          disabled={actionLoading === user._id}
                          className="flex-1 min-w-[100px] flex items-center justify-center px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 hover:cursor-pointer"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedUser(user);
                            setShowRejectModal(true);
                          }}
                          disabled={actionLoading === user._id}
                          className="flex-1 min-w-[100px] flex items-center justify-center px-3 py-2 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 hover:cursor-pointer"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * pagination.limit + 1}</span> to{" "}
                    <span className="font-medium">{Math.min(currentPage * pagination.limit, pagination.total)}</span> of{" "}
                    <span className="font-medium">{pagination.total}</span> results
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 hover:cursor-pointer "
                  >
                    Previous
                  </button>
                  <span className="px-3 py-1 text-sm text-gray-700">
                    Page {currentPage} of {pagination.pages}
                  </span>
                  <button
                    onClick={() => setCurrentPage(Math.min(pagination.pages, currentPage + 1))}
                    disabled={currentPage === pagination.pages}
                    className="px-3 py-1 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 hover:cursor-pointer "
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Reject Modal */}
      {showRejectModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Reject KYC Application</h2>
            <p className="text-gray-600 mb-4">
              Please provide a reason for rejecting {(selectedUser.fullName || selectedUser.email || "this user")}&apos;s KYC application
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
            />
            <div className="flex items-center space-x-3 mt-4">
              <button
                onClick={() => rejectKYC(selectedUser._id, rejectionReason)}
                disabled={!rejectionReason.trim()}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Reject KYC
              </button>
              <button
                onClick={() => {
                  setShowRejectModal(false);
                  setSelectedUser(null);
                  setRejectionReason("");
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div
              className={`absolute top-2 right-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium`}
            >
             <button onClick={() => setShowDetailsModal(false)} className="text-gray-500 hover:text-gray-700 hover:cursor-pointer">
                [X] Close
              </button>
            </div>

            <h2 className="text-xl font-bold mb-6">KYC Application Details</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Personal Information */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Personal Information</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Full Name</label>
                    <p className="text-gray-900">{selectedUser.fullName || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Father&apos;s Name</label>
                    <p className="text-gray-900">{selectedUser.fatherName || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Email</label>
                    <p className="text-gray-900">{selectedUser.email || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Mobile</label>
                    <p className="text-gray-900">{selectedUser.mobile || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                    <p className="text-gray-900">{selectedUser.dob ? new Date(selectedUser.dob).toLocaleDateString() : "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Occupation</label>
                    <p className="text-gray-900">{selectedUser.occupation || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Income Slab</label>
                    <p className="text-gray-900">{selectedUser.incomeSlab || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Address</label>
                    <p className="text-gray-900">{selectedUser.address || "-"}</p>
                  </div>
                </div>
              </div>

              {/* Documents */}
              <div>
                <h3 className="text-lg font-semibold mb-4">Documents</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">PAN Number</label>
                    <p className="text-gray-900">{selectedUser.panNumber || "-"}</p>
                    {selectedUser.panDocument && (
                      <a
                        href={selectedUser.panDocument}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View Document
                      </a>
                    )}
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Aadhaar Number</label>
                    <p className="text-gray-900">{selectedUser.aadhaarNumber || "-"}</p>
                    {selectedUser.aadhaarDocument && (
                      <a
                        href={selectedUser.aadhaarDocument}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 text-sm"
                      >
                        View Document
                      </a>
                    )}
                  </div>
                </div>

                <h3 className="text-lg font-semibold mb-4 mt-6">Bank Details</h3>
                <div className="space-y-3">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Account Name</label>
                    <p className="text-gray-900">{selectedUser.bankAccountName || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Account Number</label>
                    <p className="text-gray-900">{selectedUser.bankAccountNumber || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Bank Name</label>
                    <p className="text-gray-900">{selectedUser.bankName || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Bank Address</label>
                    <p className="text-gray-900">{selectedUser.bankAddress || "-"}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">IFSC Code</label>
                    <p className="text-gray-900">{selectedUser.bankIfsc || "-"}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Nominees */}
            {selectedUser.nominees && selectedUser.nominees.length > 0 && (
            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-4">Nominees</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {selectedUser.nominees.map((nominee, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded-lg">
                    <div className="space-y-2">
                      <div>
                        <label className="text-sm font-medium text-gray-500">Name</label>
                        <p className="text-gray-900">{nominee.name}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Relation</label>
                        <p className="text-gray-900">{nominee.relation}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Date of Birth</label>
                        <p className="text-gray-900">{nominee.dob ? new Date(nominee.dob).toLocaleDateString() : "-"}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-500">Mobile</label>
                        <p className="text-gray-900">{nominee.mobile}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            )}

            <div className="flex items-center justify-end space-x-3 mt-6">
              <button
                onClick={() => {
                  setShowDetailsModal(false);
                  setSelectedUser(null);
                }}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 hover:cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
