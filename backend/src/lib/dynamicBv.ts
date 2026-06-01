/** BV for dynamic_link services: final price × (bvPercentage / 100). */

export function calculateDynamicBv(finalPrice: number, bvPercentage: number): number {
  const price = Number(finalPrice);
  const pct = Number(bvPercentage);
  if (!Number.isFinite(price) || price < 0) return 0;
  if (!Number.isFinite(pct) || pct < 0) return 0;
  const bv = price * (pct / 100);
  return Math.round(bv * 100) / 100;
}

export type ServiceBvSource = {
  paymentType?: string;
  businessVolume?: number;
  bvPercentage?: number;
};

export function resolveDynamicBvPercentage(service: ServiceBvSource): number | null {
  if (service.paymentType !== "dynamic_link") return null;
  const pct = Number(service.bvPercentage);
  if (!Number.isFinite(pct) || pct < 0 || pct > 100) return null;
  return pct;
}

export function lineBvForService(service: ServiceBvSource, linePrice: number): number {
  const pct = resolveDynamicBvPercentage(service);
  if (pct != null) return calculateDynamicBv(linePrice, pct);
  return Number(service.businessVolume) || 0;
}
