import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  resolveLegRootUserIdFromParents,
  computeMaxCumulativeWithdrawalFromLegTotals,
  mergeLegEarning,
} from "../referralLegRoot";

/** Shiv → Krishna → Vansh/Aman; Manish; Shyam */
function shivTreeParents(): Map<string, string | null> {
  return new Map([
    ["shiv", null],
    ["krishna", "shiv"],
    ["vansh", "krishna"],
    ["aman", "krishna"],
    ["manish", "shiv"],
    ["shyam", "shiv"],
  ]);
}

describe("resolveLegRootUserIdFromParents", () => {
  it("level-1 buyer is leg root", () => {
    const parents = shivTreeParents();
    assert.equal(resolveLegRootUserIdFromParents("shiv", "krishna", parents), "krishna");
  });

  it("deep downline maps to direct referral leg", () => {
    const parents = shivTreeParents();
    assert.equal(resolveLegRootUserIdFromParents("shiv", "vansh", parents), "krishna");
    assert.equal(resolveLegRootUserIdFromParents("shiv", "aman", parents), "krishna");
    assert.equal(resolveLegRootUserIdFromParents("shiv", "manish", parents), "manish");
  });

  it("returns null when buyer not under earner", () => {
    const parents = shivTreeParents();
    assert.equal(resolveLegRootUserIdFromParents("krishna", "manish", parents), null);
  });
});

describe("computeMaxCumulativeWithdrawalFromLegTotals", () => {
  it("sums min(leg, cap) per leg — Shiv example", () => {
    const legs = new Map<string, number>();
    mergeLegEarning(legs, "krishna", 1000);
    mergeLegEarning(legs, "manish", 800);
    mergeLegEarning(legs, "shyam", 300);

    const max = computeMaxCumulativeWithdrawalFromLegTotals(legs, 500, 2100);
    assert.equal(max, 1300);
  });

  it("staff unlimited uses total earned", () => {
    const legs = new Map([["a", 1000]]);
    assert.equal(computeMaxCumulativeWithdrawalFromLegTotals(legs, null, 1000), 1000);
  });

  it("zero cap blocks withdrawal", () => {
    const legs = new Map([["a", 500]]);
    assert.equal(computeMaxCumulativeWithdrawalFromLegTotals(legs, 0, 500), 0);
  });
});
