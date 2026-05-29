import IncomeReportsNav from "./_components/IncomeReportsNav";

export default function AdminIncomeReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-zinc-900">Admin Income &amp; Payouts</h1>
        <p className="mt-1 max-w-3xl text-sm text-zinc-600">
          Auditable hub for your referral income, customer withdrawal requests (approve, reject, or
          pay with cash/UPI proof), manual payouts without a request, payment history, and action
          log.
        </p>
      </div>
      <IncomeReportsNav />
      {children}
    </div>
  );
}