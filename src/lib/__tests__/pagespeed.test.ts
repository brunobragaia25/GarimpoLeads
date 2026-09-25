import { describe, expect, it } from "vitest";
import { parsePageSpeed } from "../pagespeed";

describe("parsePageSpeed", () => {
  it("le nota (0-1 -> 0-100) e LCP em ms", () => {
    const json = {
      lighthouseResult: {
        categories: { performance: { score: 0.34 } },
        audits: { "largest-contentful-paint": { numericValue: 6234.7 } },
      },
    };
    expect(parsePageSpeed(json)).toEqual({ mobileScore: 34, lcpMs: 6235 });
  });

  it("resposta incompleta ou de erro vira null", () => {
    expect(parsePageSpeed({})).toBeNull();
    expect(parsePageSpeed({ lighthouseResult: { categories: { performance: { score: null } } } })).toBeNull();
    expect(parsePageSpeed(null)).toBeNull();
  });
});
