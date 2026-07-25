import { describe, expect, it } from "vitest";
import { distribuir } from "./gridSpans";

const linha = (...pesos: [string, number, boolean][]) =>
  distribuir(pesos.map(([id, peso, visivel]) => ({ id, peso, visivel })));

const soma = (m: Record<string, number>) => Object.values(m).reduce((s, v) => s + v, 0);

describe("distribuir (dashboard row spans)", () => {
  it("keeps the natural proportions when everything is visible", () => {
    expect(linha(["a", 5, true], ["b", 7, true])).toEqual({ a: 5, b: 7 });
    expect(linha(["a", 4, true], ["b", 4, true], ["c", 4, true])).toEqual({ a: 4, b: 4, c: 4 });
    expect(linha(["a", 8, true], ["b", 4, true])).toEqual({ a: 8, b: 4 });
  });

  it("gives the whole row to the last survivor", () => {
    expect(linha(["a", 5, true], ["b", 7, false])).toEqual({ a: 12 });
    expect(linha(["a", 4, false], ["b", 4, false], ["c", 4, true])).toEqual({ c: 12 });
  });

  it("splits the freed columns among the survivors — never leaves a gap", () => {
    const r = linha(["a", 4, true], ["b", 4, true], ["c", 4, false]);
    expect(soma(r)).toBe(12);
    expect(r).toEqual({ a: 6, b: 6 });
  });

  it("always totals exactly 12, whatever the mix of weights", () => {
    expect(soma(linha(["a", 8, true], ["b", 4, true], ["c", 4, true]))).toBe(12);
    expect(soma(linha(["a", 5, true], ["b", 5, true], ["c", 5, true]))).toBe(12);
    expect(soma(linha(["a", 1, true], ["b", 7, true], ["c", 2, true], ["d", 2, true]))).toBe(12);
  });

  it("never shrinks a visible card below one column", () => {
    const r = linha(["a", 1, true], ["b", 100, true]);
    expect(r.a).toBeGreaterThanOrEqual(1);
    expect(soma(r)).toBe(12);
  });

  it("returns nothing when the whole row is hidden", () => {
    expect(linha(["a", 4, false], ["b", 8, false])).toEqual({});
  });
});
