"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { Users, Settings, Mail, TrendingUp, UserCheck, UserX, Clock, CheckCircle, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface AnalyticsData {
  users: {
    total: number;
    active: number;
    providers: {
      total: number;
      active: number;
      new: number;
    };
    buyers: {
      total: number;
      active: number;
      new: number;
    };
    newRegistrations: number;
  };
  services: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    active: number;
  };
  inquiries: {
    total: number;
    pending: number;
  };
}

export default function AnalyticsPage() {
  useAuth({ requireAdmin: true });
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
    
    // Set up real-time updates every 30 seconds
    const interval = setInterval(fetchAnalytics, 30000);
    
    // Listen for storage events for cross-tab updates
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'admin-action-updated') {
        fetchAnalytics();
      }
    };
    
    globalThis.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearInterval(interval);
      globalThis.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  const fetchAnalytics = async () => {
    try {
      const response = await fetch("/api/admin/analytics");
      if (!response.ok) {
        throw new Error("Failed to fetch analytics");
      }
      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (filters: { role?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters.role) params.set("role", filters.role);
    if (filters.status) params.set("status", filters.status);
    
    const queryString = params.toString();
    const url = `/admin/users${queryString ? `?${queryString}` : ''}`;
    router.push(url);
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-4 bg-gray-200 rounded w-1/2 mb-8"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="bg-white p-6 rounded-lg border border-gray-200">
                <div className="h-12 bg-gray-200 rounded mb-4"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <h2 className="text-red-800 font-semibold mb-2">Error loading analytics</h2>
          <p className="text-red-600">{error}</p>
          <button
            onClick={fetchAnalytics}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  if (!analytics) return null;

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Analytics Dashboard</h1>
        <p className="text-lg text-gray-600">
          Comprehensive overview of your platform performance
        </p>
      </div>

      {/* User Analytics Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <Users className="w-6 h-6 mr-2 text-blue-600" />
          User Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div 
            className="bg-white p-6 rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-blue-500"
            onClick={() => handleCardClick({})}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick({});
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between mb-4">
              <Users className="w-8 h-8 text-blue-600" />
              <span className="text-sm text-gray-500">Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.users.total.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Total Users</p>
          </div>

          <div 
            className="bg-white p-6 rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-green-500"
            onClick={() => handleCardClick({ status: "active" })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick({ status: "active" });
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between mb-4">
              <UserCheck className="w-8 h-8 text-green-600" />
              <span className="text-sm text-gray-500">Active</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.users.active.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Active Users</p>
          </div>

          <div 
            className="bg-white p-6 rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-purple-500"
            onClick={() => handleCardClick({ status: "new" })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick({ status: "new" });
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between mb-4">
              <TrendingUp className="w-8 h-8 text-blue-600" />
              <span className="text-sm text-gray-500">New</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.users.newRegistrations.toLocaleString()}</p>
            <p className="text-sm text-gray-600">New This Month</p>
          </div>

          <div 
            className="bg-white p-6 rounded-lg border border-gray-200 cursor-pointer hover:shadow-lg transition-shadow focus:outline-none focus:ring-2 focus:ring-red-500"
            onClick={() => handleCardClick({ status: "suspended" })}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick({ status: "suspended" });
              }
            }}
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center justify-between mb-4">
              <UserX className="w-8 h-8 text-red-600" />
              <span className="text-sm text-gray-500">Inactive</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {(analytics.users.total - analytics.users.active).toLocaleString()}
            </p>
            <p className="text-sm text-gray-600">Inactive Users</p>
          </div>
        </div>

        {/* Provider/Buyer Breakdown */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Providers</h3>
            <div className="grid grid-cols-3 gap-4">
              <button
                className="text-center hover:bg-gray-50 p-2 rounded border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => handleCardClick({ role: "user" })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick({ role: "user" });
                  }
                }}
              >
                <p className="text-xl font-bold text-blue-600">{analytics.users.providers.total.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total</p>
              </button>
              <button
                className="text-center hover:bg-gray-50 p-2 rounded border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
                onClick={() => handleCardClick({ role: "user", status: "active" })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick({ role: "user", status: "active" });
                  }
                }}
              >
                <p className="text-xl font-bold text-green-600">{analytics.users.providers.active.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Active</p>
              </button>
              <button
                className="text-center hover:bg-gray-50 p-2 rounded border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
                onClick={() => handleCardClick({ role: "user", status: "new" })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick({ role: "user", status: "new" });
                  }
                }}
              >
                <p className="text-xl font-bold text-blue-600">{analytics.users.providers.new.toLocaleString()}</p>
                <p className="text-sm text-gray-600">New</p>
              </button>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Buyers</h3>
            <div className="grid grid-cols-3 gap-4">
              <button
                className="text-center hover:bg-gray-50 p-2 rounded border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-500"
                onClick={() => handleCardClick({ role: "admin" })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick({ role: "admin" });
                  }
                }}
              >
                <p className="text-xl font-bold text-blue-600">{analytics.users.buyers.total.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total</p>
              </button>
              <button
                className="text-center hover:bg-gray-50 p-2 rounded border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-green-500"
                onClick={() => handleCardClick({ role: "admin", status: "active" })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick({ role: "admin", status: "active" });
                  }
                }}
              >
                <p className="text-xl font-bold text-green-600">{analytics.users.buyers.active.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Active</p>
              </button>
              <button
                className="text-center hover:bg-gray-50 p-2 rounded border-0 bg-transparent cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-500"
                onClick={() => handleCardClick({ role: "admin", status: "new" })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleCardClick({ role: "admin", status: "new" });
                  }
                }}
              >
                <p className="text-xl font-bold text-blue-600">{analytics.users.buyers.new.toLocaleString()}</p>
                <p className="text-sm text-gray-600">New</p>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Service Analytics Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <Settings className="w-6 h-6 mr-2 text-blue-600" />
          Service Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Settings className="w-8 h-8 text-blue-600" />
              <span className="text-sm text-gray-500">Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.services.total.toLocaleString()}</p>
            <p className="text-sm text-gray-600">All Services</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Clock className="w-8 h-8 text-yellow-600" />
              <span className="text-sm text-gray-500">Pending</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.services.pending.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Awaiting Approval</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <span className="text-sm text-gray-500">Approved</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.services.approved.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Approved Services</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <XCircle className="w-8 h-8 text-red-600" />
              <span className="text-sm text-gray-500">Rejected</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.services.rejected.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Rejected Services</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <UserCheck className="w-8 h-8 text-blue-600" />
              <span className="text-sm text-gray-500">Active</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.services.active.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Live Services</p>
          </div>
        </div>
      </div>

      {/* Inquiry Analytics Section */}
      <div className="mb-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
          <Mail className="w-6 h-6 mr-2 text-blue-600" />
          Inquiry Analytics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Mail className="w-8 h-8 text-blue-600" />
              <span className="text-sm text-gray-500">Total</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.inquiries.total.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Total Inquiries</p>
          </div>

          <div className="bg-white p-6 rounded-lg border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <Clock className="w-8 h-8 text-yellow-600" />
              <span className="text-sm text-gray-500">Pending</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{analytics.inquiries.pending.toLocaleString()}</p>
            <p className="text-sm text-gray-600">Pending Response</p>
          </div>
        </div>
      </div>

      {/* Quick Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-gray-50 rounded-lg p-8 border border-blue-200">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Platform Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{analytics.users.total.toLocaleString()}</p>
            <p className="text-gray-600">Total Users</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Settings className="w-8 h-8 text-green-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{analytics.services.active.toLocaleString()}</p>
            <p className="text-gray-600">Active Services</p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <TrendingUp className="w-8 h-8 text-blue-600" />
            </div>
            <p className="text-3xl font-bold text-gray-900">{analytics.users.newRegistrations.toLocaleString()}</p>
            <p className="text-gray-600">New Users This Month</p>
          </div>
        </div>
      </div>
    </div>
  );
}
