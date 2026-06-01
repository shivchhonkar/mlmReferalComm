import { z } from "zod";
import { isDynamicLinkService } from "@/lib/servicePayment";

/** Parsed BV fields for service create/update (fixed vs dynamic). */
export type ParsedServiceBvFields = {
  businessVolume: number;
  bvPercentage?: number;
};

export function parseServiceBvFields(input: {
  paymentType?: string;
  businessVolume?: number;
  bvPercentage?: number;
}): ParsedServiceBvFields {
  const paymentType = input.paymentType ?? "fixed_upi";

  if (isDynamicLinkService(paymentType)) {
    let bvPercentage = Number(input.bvPercentage);
    if (!Number.isFinite(bvPercentage)) {
      // Legacy admin UI sent fixed BV in businessVolume; treat 0–100 as percentage.
      const legacy = Number(input.businessVolume);
      if (Number.isFinite(legacy) && legacy >= 0 && legacy <= 100) {
        bvPercentage = legacy;
      }
    }
    if (!Number.isFinite(bvPercentage) || bvPercentage < 0 || bvPercentage > 100) {
      throw new Error("BV percentage is required for dynamic services (0–100).");
    }
    return { businessVolume: 0, bvPercentage };
  }

  const businessVolume = Number(input.businessVolume);
  if (!Number.isFinite(businessVolume) || businessVolume < 0) {
    throw new Error("Business volume is required for fixed price services.");
  }
  return { businessVolume };
}

export const serviceBvZodRefine = (
  data: { paymentType?: string; businessVolume?: number; bvPercentage?: number },
  ctx: z.RefinementCtx,
) => {
  try {
    parseServiceBvFields(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Invalid BV fields";
    const path =
      isDynamicLinkService(data.paymentType) ? (["bvPercentage"] as const) : (["businessVolume"] as const);
    ctx.addIssue({ code: z.ZodIssueCode.custom, message, path: [...path] });
  }
};
