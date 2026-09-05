import { expect, test } from "bun:test";

import { money as quoteMoney } from "@/features/quotes/rules";
import { money as shellMoney } from "@/features/shell/format";
import { documentMoney, money } from "@/lib/money";

test("all currency formatters use rupees and Indian grouping without conversion", () => {
  for (const format of [money, quoteMoney, shellMoney]) {
    expect(format(0)).toBe("₹0.00");
    expect(format(2968135)).toBe("₹29,681.35");
    expect(format(123456789)).toBe("₹12,34,567.89");
    expect(format(-2300)).toBe("-₹23.00");
  }
  expect(documentMoney(2968135)).toBe("INR 29,681.35");
  expect(documentMoney(-2300)).toBe("-INR 23.00");
});
