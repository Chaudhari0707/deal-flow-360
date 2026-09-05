import { expect, test } from "@playwright/test";

test("the local app serves compiled Tailwind styles @regression", async ({ page }) => {
  await page.goto("/login");
  const signIn = page.getByRole("button", { name: "Sign in", exact: true });
  await expect(signIn).toHaveCSS("align-items", "center");
  await expect(page.locator("body")).toHaveCSS("font-family", /(?:ui-sans-serif|system-ui)/);
  await expect(page.locator("main")).toHaveCSS("display", "flex");
});
