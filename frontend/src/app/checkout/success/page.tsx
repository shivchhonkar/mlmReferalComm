import Link from "next/link";

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams?: Promise<{ orderId?: string }>;
}) {
  const params: { orderId?: string } = await (searchParams ?? Promise.resolve({}));
  const orderId = typeof params.orderId === "string" ? params.orderId : undefined;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/60 via-white to-zinc-50">
      <div className="mx-auto max-w-2xl px-6 py-14">
        <div className="rounded-3xl border border-emerald-200 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-emerald-600/10" />
          <h1 className="text-3xl  text-zinc-900">
            Order Placed ✅
          </h1>
          <p className="mt-3 text-zinc-600">
            Your order is created successfully. Payment is pending (will be enabled later).
          </p>

          {orderId ? (
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50 px-5 py-3 text-sm font-bold text-zinc-800">
              Order ID: <span className="">{orderId}</span>
            </div>
          ) : null}

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/services"
              className="inline-flex items-center justify-center rounded-2xl bg-emerald-600 px-6 py-3 text-sm  text-white shadow-sm hover:bg-emerald-700"
            >
              Continue Shopping
            </Link>
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center rounded-2xl border border-zinc-200 bg-white px-6 py-3 text-sm font-bold text-zinc-800 shadow-sm hover:bg-zinc-50"
            >
              Go to Dashboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
