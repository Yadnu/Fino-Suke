import { describe, it, expect } from "vitest";
import { sumAccounts } from "@/lib/networth";

describe("sumAccounts", () => {
  it("returns zero totals for an empty list", () => {
    expect(sumAccounts([])).toEqual({ totalAssets: 0, totalLiabilities: 0, netWorth: 0 });
  });

  it("sums only assets when no liabilities present", () => {
    const accounts = [
      { type: "asset", value: 5000 },
      { type: "asset", value: 3000 },
    ];
    expect(sumAccounts(accounts)).toEqual({
      totalAssets: 8000,
      totalLiabilities: 0,
      netWorth: 8000,
    });
  });

  it("sums only liabilities when no assets present", () => {
    const accounts = [
      { type: "liability", value: 2000 },
      { type: "liability", value: 500 },
    ];
    expect(sumAccounts(accounts)).toEqual({
      totalAssets: 0,
      totalLiabilities: 2500,
      netWorth: -2500,
    });
  });

  it("computes net worth as assets minus liabilities", () => {
    const accounts = [
      { type: "asset", value: 10000 },
      { type: "liability", value: 3000 },
    ];
    expect(sumAccounts(accounts)).toEqual({
      totalAssets: 10000,
      totalLiabilities: 3000,
      netWorth: 7000,
    });
  });

  it("rounds to 2 decimal places", () => {
    const accounts = [
      { type: "asset", value: 0.1 },
      { type: "asset", value: 0.2 },
    ];
    const result = sumAccounts(accounts);
    expect(result.totalAssets).toBe(0.3);
    expect(result.netWorth).toBe(0.3);
  });

  it("returns negative net worth when liabilities exceed assets", () => {
    const accounts = [
      { type: "asset", value: 1000 },
      { type: "liability", value: 4000 },
    ];
    expect(sumAccounts(accounts).netWorth).toBe(-3000);
  });
});
