"use client";

import { GoogleLogin, type CredentialResponse } from "@react-oauth/google";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { signInWithGoogle } from "@/lib/googleAuth";
import { apiFetch, readApiBody } from "@/lib/apiClient";
import { useAppDispatch } from "@/store/hooks";
import { setUserProfile } from "@/store/slices/userSlice";
import { showErrorToast } from "@/lib/toast";

type GoogleSignInButtonProps = {
  redirectPath?: string;
  referralCode?: string;
};

export default function GoogleSignInButton({
  redirectPath = "/dashboard",
  referralCode = "",
}: GoogleSignInButtonProps) {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const [busy, setBusy] = useState(false);

  const clientId = (process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || "").trim();
  if (!clientId) {
    return null;
  }

  const finishLogin = async () => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    let userRole = "user";
    try {
      const meRes = await apiFetch("/api/me");
      const meBody = await readApiBody(meRes);
      const meJson = meBody.json as { user?: { role?: string } } | null;
      if (meRes.ok && meJson?.user) {
        dispatch(setUserProfile(meJson.user as Parameters<typeof setUserProfile>[0]));
        userRole = meJson.user.role ?? "user";
      }
    } catch {
      // ignore
    }
    const isAdminRole = ["super_admin", "admin", "moderator"].includes(userRole);
    router.push(isAdminRole ? "/dashboard/admin" : redirectPath);
    router.refresh();
  };

  const handleSuccess = async (response: CredentialResponse) => {
    if (!response.credential) {
      showErrorToast("Google sign-in was cancelled");
      return;
    }

    setBusy(true);
    try {
      const result = await signInWithGoogle(response.credential);

      if ("success" in result && result.success) {
        await finishLogin();
        return;
      }

      if ("requiresProfile" in result && result.requiresProfile) {
        sessionStorage.setItem("google_pending_token", result.pendingToken);
        const params = new URLSearchParams({ redirect: redirectPath });
        if (result.profile.email) params.set("email", result.profile.email);
        if (result.profile.name) params.set("name", result.profile.name);
        if (referralCode.trim()) params.set("referralCode", referralCode.trim());
        router.push(`/auth/google/complete?${params.toString()}`);
      }
    } catch (err: unknown) {
      showErrorToast(err instanceof Error ? err.message : "Google sign-in failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`w-full ${busy ? "pointer-events-none opacity-60" : ""}`}>
      <div className="flex justify-center [&>div]:w-full [&>div]:flex [&>div]:justify-center">
        <GoogleLogin
          onSuccess={handleSuccess}
          onError={() => showErrorToast("Google sign-in failed. Please try again.")}
          useOneTap={false}
          theme="outline"
          size="large"
          text="continue_with"
          shape="rectangular"
          width="360"
        />
      </div>
    </div>
  );
}
