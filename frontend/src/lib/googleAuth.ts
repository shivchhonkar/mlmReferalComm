import { apiFetch, readApiBody } from "@/lib/apiClient";

export type GoogleAuthResult =
  | { success: true }
  | {
      requiresProfile: true;
      pendingToken: string;
      profile: { email: string; name: string; picture?: string };
    };

export async function signInWithGoogle(credential: string): Promise<GoogleAuthResult> {
  const res = await apiFetch("/api/auth/google", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ credential }),
  });

  const body = await readApiBody(res);
  const data = body.json as {
    success?: boolean;
    requiresProfile?: boolean;
    pendingToken?: string;
    profile?: { email: string; name: string; picture?: string };
    error?: string;
    message?: string;
  } | null;

  if (!res.ok) {
    throw new Error(data?.error || data?.message || "Google sign-in failed");
  }

  if (data?.requiresProfile && data.pendingToken && data.profile) {
    return {
      requiresProfile: true,
      pendingToken: data.pendingToken,
      profile: data.profile,
    };
  }

  if (data?.success !== false) {
    return { success: true };
  }

  throw new Error(data?.error || "Google sign-in failed");
}

export async function completeGoogleProfile(payload: {
  pendingToken: string;
  name: string;
  fullName: string;
  mobile: string;
  countryCode: string;
  referralCode?: string;
  acceptedTerms: boolean;
}): Promise<void> {
  const res = await apiFetch("/api/auth/google/complete-profile", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, acceptedTerms: true }),
  });

  const body = await readApiBody(res);
  const data = body.json as { error?: string; message?: string } | null;

  if (!res.ok) {
    throw new Error(data?.error || data?.message || "Failed to complete sign up");
  }
}
