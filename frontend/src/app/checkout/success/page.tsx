import { CheckCircle2, Package, Receipt } from "lucide-react";
import Link from "next/link";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ orderId?: string }>;
}) {
  const params = (await (searchParams ?? Promise.resolve({}))) as { orderId?: string };
  const orderId = typeof params.orderId === "string" ? params.orderId : undefined;

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="h-1 bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />

      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="h-1 w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-sky-600" />
          <div className="p-8 text-center sm:p-10">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <CheckCircle2 className="h-9 w-9 text-emerald-600" />
            </div>
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Order placed
            </h1>
            <p className="mt-2 text-slate-600">
              Your service order has been created. Cash orders are confirmed; UPI orders require payment proof review; pay-later orders will be updated when payment is received.
            </p>

            {orderId ? (
              <div className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Receipt className="h-5 w-5 text-slate-500" />
                <span className="text-sm font-semibold text-slate-800">
                  Order ID: <span className="font-mono text-emerald-700">{orderId}</span>
                </span>
              </div>
            ) : null}

            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/dashboard/orders"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-95"
              >
                <Receipt className="h-4 w-4" />
                View orders
              </Link>
              <Link
                href="/services"
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50"
              >
                <Package className="h-4 w-4" />
                Browse services
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
