"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { User, ChevronDown, LogOut, Settings, Link as LinkIcon, UserCircle, ShoppingBag, Home, Users, Image as ImageIcon } from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/store/hooks";
import { clearUserProfile } from "@/store/slices/userSlice";
import { apiFetch } from "@/lib/apiClient";

export default function ProfileSection() {
  const user = useAppSelector((s) => s.user.profile);
  const dispatch = useAppDispatch();
  const [isProfileDropdownOpen, setIsProfileDropdownOpen] = useState(false);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const profileDropdownRef = useRef<HTMLDivElement>(null);

  // Function to refresh user data
  const refreshUserData = async () => {
    try {
      const res = await apiFetch("/api/me");
      if (res.ok) {
        const body = await res.json();
        if (body.user) {
          dispatch({ type: 'user/setUserProfile', payload: body.user });
          if (typeof window !== 'undefined') {
            localStorage.setItem('user', JSON.stringify(body.user));
          }
        }
      }
    } catch (error) {
      console.error("Failed to refresh user data:", error);
    }
  };

  // Check authentication state on mount
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        // Check if we have user in localStorage first
        const storedUser = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
        if (storedUser) {
          try {
            const parsedUser = JSON.parse(storedUser);
            // If we have stored user, set it immediately to prevent flash
            dispatch({ type: 'user/setUserProfile', payload: parsedUser });
          } catch {
            console.warn("Failed to parse stored user");
            localStorage.removeItem('user');
          }
        }
        
        // Then verify with server
        await refreshUserData();
      } catch (error) {
        console.error("Auth check failed:", error);
        // Don't clear user state on network errors, let localStorage handle it
      } finally {
        setIsAuthLoading(false);
      }
    };

    checkAuthState();
  }, [dispatch]);

  // Listen for profile updates from other components
  useEffect(() => {
    const handleProfileUpdate = () => {
      refreshUserData();
    };

    // Listen for custom event when profile is updated
    window.addEventListener('profileUpdated', handleProfileUpdate);
    
    return () => {
      window.removeEventListener('profileUpdated', handleProfileUpdate);
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
        setIsProfileDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      dispatch(clearUserProfile());
      if (typeof window !== 'undefined') {
        localStorage.removeItem('user');
      }
      window.location.href = "/login";
    }
  };

  // Show loading state while checking authentication
  if (isAuthLoading) {
    return (
      <div className="relative">
        <div className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 rounded-md">
          <div className="w-6 h-6 rounded-full bg-gray-200 animate-pulse"></div>
          <div className="w-16 h-4 bg-gray-200 rounded animate-pulse"></div>
          <ChevronDown className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative" ref={profileDropdownRef}>
      <button
        onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 hover:text-blue-600 hover:bg-gray-50 rounded-md transition-colors"
      >
        <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center overflow-hidden">
          {user ? (
            user.profileImage && typeof user.profileImage === 'string' ? (
              <img 
                src={
                  user.profileImage.startsWith('http') 
                    ? user.profileImage 
                    : user.profileImage.startsWith('/uploads')
                    ? `http://localhost:4000${user.profileImage}`
                    : user.profileImage
                }
                alt="Profile" 
                className="w-6 h-6 rounded-full object-cover"
                onError={(e) => {
                  console.error('Failed to load profile image:', user.profileImage);
                  e.currentTarget.style.display = 'none';
                }}
              />
            ) : (
              <User className="w-4 h-4 text-white" />
            )
          ) : (
            <UserCircle className="w-4 h-4 text-white" />
          )}
        </div>
        <span className="hidden md:block truncate max-w-[120px]">
          {user ? (user.name || user.email || "User") : "Hello, Guest"}
        </span>
        <ChevronDown className="w-4 h-4" />
      </button>

      {/* Profile Dropdown */}
      {isProfileDropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="py-1">
            {user ? (
              // Logged-in user menu
              <>
                <div className="px-4 py-2 text-xs text-gray-700 border-b border-gray-200">
                  Signed in as {user.name || user.email}
                </div>
                
                {/* User-specific options */}
                <Link
                  href="/dashboard"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => setIsProfileDropdownOpen(false)}
                >
                  <Home className="w-4 h-4" />
                  Dashboard
                </Link>
                
                <Link
                  href="/profile"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => setIsProfileDropdownOpen(false)}
                >
                  <UserCircle className="w-4 h-4" />
                  Profile
                </Link>
                
                <Link
                  href="/orders"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => setIsProfileDropdownOpen(false)}
                >
                  <ShoppingBag className="w-4 h-4" />
                  Orders
                </Link>

                <Link
                  href="/referrals"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => setIsProfileDropdownOpen(false)}
                >
                  <LinkIcon className="w-4 h-4" />
                  Referral
                </Link>

                {/* Admin-specific options */}
                {user.role === "admin" && (
                  <>
                    <div className="border-t border-gray-200 my-1"></div>
                    <Link
                      href="/admin"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      <Settings className="w-4 h-4" />
                      Admin Panel
                    </Link>
                    
                    <Link
                      href="/admin/users"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      <Users className="w-4 h-4" />
                      Manage Users
                    </Link>
                    
                    <Link
                      href="/admin/slider"
                      className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                      onClick={() => setIsProfileDropdownOpen(false)}
                    >
                      <ImageIcon className="w-4 h-4" />
                      Manage Sliders
                    </Link>
                  </>
                )}

                <div className="border-t border-gray-200 my-1"></div>
                <Link
                  href="/settings"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => setIsProfileDropdownOpen(false)}
                >
                  <Settings className="w-4 h-4" />
                  Settings
                </Link>

                <button
                  onClick={() => {
                    setIsProfileDropdownOpen(false);
                    handleLogout();
                  }}
                  className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </>
            ) : (
              // Logged-out user menu
              <>
                <div className="px-4 py-2 text-xs text-gray-700 border-b border-gray-200">
                  Welcome, Guest
                </div>
                
                <Link
                  href="/login"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => setIsProfileDropdownOpen(false)}
                >
                  <User className="w-4 h-4" />
                  Sign In
                </Link>
                
                <Link
                  href="/register"
                  className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
                  onClick={() => setIsProfileDropdownOpen(false)}
                >
                  <UserCircle className="w-4 h-4" />
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
