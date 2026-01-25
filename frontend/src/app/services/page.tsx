import { apiUrl } from "@/lib/apiClient";
import ServicesCategoryClient from "@/app/services/ServicesCategoryClient";
import { headers } from "next/headers";
import type { Service } from "@/store/slices/serviceSlice";
import type { Category } from "@/store/slices/categorySlice";

export const runtime = "nodejs";

async function getServices() {
  try {
    const url = apiUrl("/api/services");
    let absoluteUrl = url;
    if (url.startsWith("/")) {
      const h = await headers();
      const proto = h.get("x-forwarded-proto") ?? "http";
      const host = h.get("x-forwarded-host") ?? h.get("host");
      const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
      absoluteUrl = origin ? `${origin}${url}` : url;
    }

    const res = await fetch(absoluteUrl, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.services as Service[] || [];
  } catch {
    return [];
  }
}

async function getCategories() {
  try {
    const url = apiUrl("/api/categories");
    let absoluteUrl = url;
    if (url.startsWith("/")) {
      const h = await headers();
      const proto = h.get("x-forwarded-proto") ?? "http";
      const host = h.get("x-forwarded-host") ?? h.get("host");
      const origin = host ? `${proto}://${host}` : (process.env.NEXT_PUBLIC_API_BASE_URL ?? "");
      absoluteUrl = origin ? `${origin}${url}` : url;
    }

    const res = await fetch(absoluteUrl, {
      cache: "no-store",
    });
    if (!res.ok) return [];
    const data = await res.json();
    return data.categories as Category[] || [];
  } catch {
    return [];
  }
}

export default async function ServicesPage() {
  const [services, categories] = await Promise.all([getServices(), getCategories()]);

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <ServicesCategoryClient services={services} categories={categories} />
      </div>
    </div>
  );
}
