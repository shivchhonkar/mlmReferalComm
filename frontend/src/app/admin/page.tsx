"use client";

import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { Settings, List, Users, BarChart3, Mail, Image as ImageIcon, UserCheck, FolderOpen, CreditCard, FileCheck } from "lucide-react";

export default function AdminPage() {
  useAuth({ requireAdmin: true }); // Protect admin page

  return (
    <div className="container mx-auto px-4 py-12 max-w-7xl">
      {/* Header */}
      <div className="mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Admin Panel</h1>
        <p className="text-lg text-gray-600">
          Manage your platform settings and configurations
        </p>
      </div>

      {/* Admin Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Analytics Dashboard */}
        <Link
          href="/admin/analytics"
          className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">
            Analytics Dashboard
          </h3>
          <p className="text-gray-600">
            View comprehensive platform analytics and insights
          </p>
        </Link>

        {/* User Management */}
        <Link
          href="/admin/users"
          className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">
            User Management
          </h3>
          <p className="text-gray-600">
            Create, manage and monitor user accounts and roles
          </p>
        </Link>

        {/* Service Approval */}
        <Link
          href="/admin/service-approval"
          className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <UserCheck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">
            Service Approval
          </h3>
          <p className="text-gray-600">
            Review and approve/reject service listings
          </p>
        </Link>

        {/* Category Management */}
        <Link
          href="/admin/categories"
          className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <FolderOpen className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">
            Categories & Subcategories
          </h3>
          <p className="text-gray-600">
            Manage service categories and subcategories
          </p>
        </Link>

        {/* KYC Management */}
        <Link
          href="/admin/kyc"
          className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <FileCheck className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">
            KYC Management
          </h3>
          <p className="text-gray-600">
            Review and approve user KYC submissions
          </p>
        </Link>

        {/* Payment Settings */}
        <Link
          href="/admin/payment-settings"
          className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <CreditCard className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">
            Payment Settings
          </h3>
          <p className="text-gray-600">
            Configure payment links and UPI settings
          </p>
        </Link>

        {/* Contact Management */}
        <Link
          href="/admin/contacts"
          className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <Mail className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">
            Contact Submissions
          </h3>
          <p className="text-gray-600">
            View and manage contact form submissions from users
          </p>
        </Link>

        {/* Services Management */}
        <Link
          href="/admin/services"
          className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <Settings className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">
            Services
          </h3>
          <p className="text-gray-600">
            Create and manage services, set pricing and business volume
          </p>
        </Link>

        {/* Slider Management */}
        <Link
          href="/admin/slider"
          className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <ImageIcon className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">
            Manage Sliders
          </h3>
          <p className="text-gray-600">
            Control home page slider images and content
          </p>
        </Link>

        {/* Distribution Rules */}
        <Link
          href="/admin/rules"
          className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <List className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">
            Distribution Rules
          </h3>
          <p className="text-gray-600">
            Configure commission rules and distribution percentages
          </p>
        </Link>

        {/* User Dashboard Link */}
        <Link
          href="/dashboard"
          className="bg-white rounded-lg border border-gray-200 p-8 hover:shadow-md transition-shadow group"
        >
          <div className="flex items-start justify-between mb-4">
            <div className="p-3 rounded-lg bg-blue-100">
              <BarChart3 className="w-6 h-6 text-blue-600" />
            </div>
          </div>
          <h3 className="text-xl font-bold mb-2 text-gray-900">
            User Dashboard
          </h3>
          <p className="text-gray-600">
            View platform as a regular user
          </p>
        </Link>
      </div>

      {/* Quick Stats Section */}
      <div className="mt-12 bg-white rounded-lg border border-gray-200 p-8">
        <h2 className="text-2xl font-bold mb-6 text-gray-900">Quick Overview</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <Users className="w-10 h-10 mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-gray-600">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">-</p>
          </div>
          <div className="text-center">
            <Settings className="w-10 h-10 mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-gray-600">Active Services</p>
            <p className="text-2xl font-bold text-gray-900">-</p>
          </div>
          <div className="text-center">
            <BarChart3 className="w-10 h-10 mx-auto mb-2 text-blue-600" />
            <p className="text-sm text-gray-600">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">-</p>
          </div>
        </div>
      </div>
    </div>
  );
}
