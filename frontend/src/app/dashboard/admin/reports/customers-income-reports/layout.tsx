import IncomeReportsNav from "./_components/IncomeReportsNav";

export default function IncomeReportsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <div className="mb-2">
        <h1 className="text-xl font-semibold text-zinc-900">Customers Income Reports</h1>
        <p className="mt-1 text-sm text-zinc-600">
          Customer referral income, payouts, payment history, and admin payment audit trail
        </p>
      </div>
      <IncomeReportsNav />
      {children}
    </div>
  );
}
