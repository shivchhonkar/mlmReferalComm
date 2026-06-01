import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { calculateDynamicBv, lineBvForService } from "@/lib/dynamicBv";

describe("calculateDynamicBv", () => {
  it("computes BV as price × percentage", () => {
    assert.equal(calculateDynamicBv(1000, 30), 300);
    assert.equal(calculateDynamicBv(2000, 50), 1000);
    assert.equal(calculateDynamicBv(5000, 80), 4000);
  });

  it("rounds to two decimal places", () => {
    assert.equal(calculateDynamicBv(333, 33), 109.89);
  });
});

describe("lineBvForService", () => {
  it("uses bvPercentage for dynamic_link", () => {
    assert.equal(
      lineBvForService({ paymentType: "dynamic_link", bvPercentage: 30, businessVolume: 99 }, 1000),
      300,
    );
  });

  it("uses businessVolume for fixed_upi", () => {
    assert.equal(lineBvForService({ paymentType: "fixed_upi", businessVolume: 50 }, 1000), 50);
  });
});
