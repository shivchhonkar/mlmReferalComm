export type ReportPeriodKey = "weekly" | "monthly" | "yearly" | "custom";

export type ReportPeriodRange = {
  key: ReportPeriodKey;
  label: string;
  start: Date;
  end: Date;
};

function parseDateOnly(value: string, endOfDay: boolean): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  if (!Number.isFinite(y) || !Number.isFinite(mo) || !Number.isFinite(d)) return null;
  return endOfDay
    ? new Date(y, mo, d, 23, 59, 59, 999)
    : new Date(y, mo, d, 0, 0, 0, 0);
}

export function resolveReportPeriodRange(
  periodRaw: string,
  fromRaw?: string,
  toRaw?: string,
): ReportPeriodRange {
  const period = String(periodRaw ?? "monthly")
    .trim()
    .toLowerCase() as ReportPeriodKey;

  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  if (period === "custom") {
    const from = fromRaw ? parseDateOnly(fromRaw, false) : null;
    const to = toRaw ? parseDateOnly(toRaw, true) : null;
    if (!from || !to || from.getTime() > to.getTime()) {
      throw new Error("Custom range requires valid from and to dates (YYYY-MM-DD).");
    }
    return { key: "custom", label: "Custom", start: from, end: to };
  }

  if (period === "weekly") {
    const day = new Date(y, m, d).getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const start = new Date(y, m, d + mondayOffset, 0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { key: "weekly", label: "Weekly", start, end };
  }

  if (period === "yearly") {
    return {
      key: "yearly",
      label: "Yearly",
      start: new Date(y, 0, 1, 0, 0, 0, 0),
      end: new Date(y, 11, 31, 23, 59, 59, 999),
    };
  }

  const start = new Date(y, m, 1, 0, 0, 0, 0);
  const end = new Date(y, m + 1, 0, 23, 59, 59, 999);
  return { key: "monthly", label: "Monthly", start, end };
}
