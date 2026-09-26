import {
  calculate,
  sanitizeTemplate,
  validateTemplate,
  questions,
} from "../src/proposals/proposal-utils";
describe("Commercial and template integrity", () => {
  it("uses decimal currency rounding and rejects forged price inputs", () => {
    const c = {
      items: [{ id: "a", description: "Service", unitPrice: 0.1 }],
      tax_pct: 18,
    };
    expect(
      calculate(c, [{ itemId: "a", qty: 3, unitPrice: 100 }], 0).total,
    ).toBe(0.35);
    expect(() => calculate(c, [{ itemId: "a", qty: -1 }], 0)).toThrow();
    expect(() => calculate(c, [{ itemId: "missing", qty: 1 }], 0)).toThrow();
    expect(() => calculate(c, [{ itemId: "a", qty: 1 }], 101)).toThrow();
  });
  it("removes executable markup and outside resources from uploaded templates", () => {
    const s = sanitizeTemplate(
      '<script>fetch("/api/auth/me")</script><img src="https://attacker.test/a"><p onclick="alert(1)" style="background-image:url(https://attacker.test/x)">Hello</p>{{commercial_table}}',
    );
    expect(s).not.toMatch(/<script|onclick|<img|url\(/);
    expect(s).toContain("<p>Hello</p>");
  });
  it("requires the price table and known question placeholders", () => {
    expect(() => validateTemplate("<p>{{scope}}</p>", [])).toThrow();
    expect(() =>
      validateTemplate("{{commercial_table}} {{unknown}}", []),
    ).toThrow();
    expect(() =>
      questions([{ key: "total", label: "Replace total" }]),
    ).toThrow();
    expect(
      validateTemplate("{{commercial_table}} {{scope}}", [{ key: "scope" }]),
    ).toContain("{{scope}}");
  });
});
