export type OrderReportType = "monthly" | "quarterly" | "annual" | "custom";

export type OrderReportEntry = {
  id: string;
  orderNumber: string;
  date: string;
  total: number;
  status: string;
  customerName?: string;
  customerEmail?: string;
  customerMobile?: string;
  paymentMode?: string;
  paymentStatus?: string;
  servicePaymentStatus?: string;
  items: number;
};

export type OrderReportRow = {
  key: string;
  periodLabel: string;
  periodStart: Date;
  orderCount: number;
  totalAmount: number;
  paidCount: number;
  pendingCount: number;
  entries: OrderReportEntry[];
};

function parseOrderDate(date: string): Date | null {
  const d = new Date(date);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function isOrderPaid(entry: Pick<OrderReportEntry, "paymentStatus" | "servicePaymentStatus">): boolean {
  return entry.paymentStatus === "PAID" || entry.servicePaymentStatus === "paid";
}

export function getOrderPeriodMeta(
  date: string,
  type: OrderReportType,
  customFrom = "",
  customTo = ""
): { key: string; periodLabel: string; periodStart: Date } | null {
  const d = parseOrderDate(date);
  if (!d) return null;

  const year = d.getFullYear();
  const month = d.getMonth() + 1;
  const quarter = Math.floor((month - 1) / 3) + 1;

  if (type === "custom") {
    return {
      key: "custom",
      periodLabel:
        customFrom || customTo ? `${customFrom || "Start"} to ${customTo || "End"}` : "Custom Period",
      periodStart: customFrom ? new Date(`${customFrom}T00:00:00`) : new Date(0),
    };
  }
  if (type === "monthly") {
    return {
      key: `${year}-${String(month).padStart(2, "0")}`,
      periodLabel: d.toLocaleDateString("en-IN", { month: "long", year: "numeric" }),
      periodStart: new Date(year, month - 1, 1),
    };
  }
  if (type === "quarterly") {
    return {
      key: `${year}-Q${quarter}`,
      periodLabel: `Q${quarter} ${year}`,
      periodStart: new Date(year, (quarter - 1) * 3, 1),
    };
  }
  return {
    key: `${year}`,
    periodLabel: String(year),
    periodStart: new Date(year, 0, 1),
  };
}

export function filterOrdersByDateRange<T extends { date: string }>(
  orders: T[],
  from: string,
  to: string
): T[] {
  const fromDt = from ? new Date(`${from}T00:00:00`) : null;
  const toDt = to ? new Date(`${to}T23:59:59.999`) : null;
  return orders.filter((order) => {
    const dt = parseOrderDate(order.date);
    if (!dt) return false;
    if (fromDt && dt < fromDt) return false;
    if (toDt && dt > toDt) return false;
    return true;
  });
}

export function filterOrdersByPeriodKey<T extends { date: string }>(
  orders: T[],
  type: OrderReportType,
  periodKey: string,
  customFrom = "",
  customTo = ""
): T[] {
  if (!periodKey) return orders;
  return orders.filter((order) => {
    const meta = getOrderPeriodMeta(order.date, type, customFrom, customTo);
    return meta?.key === periodKey;
  });
}

export function buildOrderReportRows(
  orders: OrderReportEntry[],
  type: OrderReportType,
  customFrom = "",
  customTo = ""
): OrderReportRow[] {
  const grouped = new Map<
    string,
    {
      key: string;
      periodLabel: string;
      periodStart: Date;
      orderCount: number;
      totalAmount: number;
      paidCount: number;
      pendingCount: number;
      entries: OrderReportEntry[];
    }
  >();

  orders.forEach((order) => {
    const meta = getOrderPeriodMeta(order.date, type, customFrom, customTo);
    if (!meta) return;

    if (!grouped.has(meta.key)) {
      grouped.set(meta.key, {
        key: meta.key,
        periodLabel: meta.periodLabel,
        periodStart: meta.periodStart,
        orderCount: 0,
        totalAmount: 0,
        paidCount: 0,
        pendingCount: 0,
        entries: [],
      });
    }

    const target = grouped.get(meta.key)!;
    target.orderCount += 1;
    target.totalAmount += order.total ?? 0;
    if (isOrderPaid(order)) target.paidCount += 1;
    else target.pendingCount += 1;
    target.entries.push(order);
  });

  return Array.from(grouped.values())
    .sort((a, b) => b.periodStart.getTime() - a.periodStart.getTime())
    .map((entry) => ({
      ...entry,
      entries: entry.entries.sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
      ),
    }));
}

export function orderRowPeriodLabel(
  date: string,
  type: OrderReportType,
  customFrom = "",
  customTo = ""
): string {
  return getOrderPeriodMeta(date, type, customFrom, customTo)?.periodLabel ?? "-";
}

export function paymentStatusLabel(order: Pick<OrderReportEntry, "paymentStatus" | "servicePaymentStatus">): string {
  if (isOrderPaid(order)) return "Paid";
  if (order.paymentStatus === "FAILED") return "Failed";
  if (order.servicePaymentStatus) {
    return order.servicePaymentStatus.replace(/_/g, " ");
  }
  return order.paymentStatus === "PENDING" ? "Pending" : order.paymentStatus || "Pending";
}
