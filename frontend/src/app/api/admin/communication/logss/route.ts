import { NextRequest, NextResponse } from "next/server";

function resolveBackendBase() {
  const raw = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  if (!raw) return "";
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

function buildBackendLogsUrl(limit: string) {
  const base = resolveBackendBase();
  if (!base) return "";
  const root = base.replace(/\/api\/?$/, "");
  return `${root}/api/admin/communication/logs?limit=${encodeURIComponent(limit)}`;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const limit = searchParams.get("limit") || "5000";
    const upstreamUrl = buildBackendLogsUrl(limit);

    if (!upstreamUrl) {
      return NextResponse.json(
        {
          success: false,
          error: "Backend URL is not configured",
          logs: [],
          total: 0,
        },
        { status: 500 }
      );
    }

    const cookie = req.headers.get("cookie") || "";
    const upstreamRes = await fetch(upstreamUrl, {
      method: "GET",
      headers: {
        accept: "application/json",
        ...(cookie ? { cookie } : {}),
      },
      cache: "no-store",
    });

    const contentType = upstreamRes.headers.get("content-type") || "";
    const text = await upstreamRes.text();

    if (!upstreamRes.ok) {
      if (upstreamRes.status === 404) {
        return NextResponse.json({
          success: true,
          logs: [],
          total: 0,
          fallback: true,
          message: "Upstream communication logs endpoint not found",
        });
      }

      const maybeJson =
        contentType.includes("application/json") && text
          ? (JSON.parse(text) as { error?: string })
          : undefined;
      return NextResponse.json(
        {
          success: false,
          error: maybeJson?.error || text || `Upstream request failed (${upstreamRes.status})`,
          logs: [],
          total: 0,
        },
        { status: upstreamRes.status }
      );
    }

    const data = text ? JSON.parse(text) : { success: true, logs: [], total: 0 };
    return NextResponse.json(data);
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch communication logs",
        logs: [],
        total: 0,
      },
      { status: 500 }
    );
  }
}
