import { describe, expect, test } from "bun:test";

import { Elysia } from "elysia";

import { movementResponseModel } from "@/features/inventory/model";

function app(handler: () => { movementId: string; repeated: boolean; status?: string }) {
  return new Elysia({ normalize: false })
    .onError(({ code, set }) => {
      if (code === "VALIDATION") {
        set.status = 400;
        return { error: "Check the request fields and try again." };
      }
    })
    .post("/", handler, { response: { 200: movementResponseModel } });
}

describe("movement response contract", () => {
  test("first ship 200 cannot include fulfillment status", async () => {
    const extra = await app(() => ({
      movementId: "m1",
      repeated: false,
      status: "FULFILLED",
    })).handle(new Request("http://localhost/", { method: "POST" }));
    expect(extra.status).toBe(400);

    const ok = await app(() => ({ movementId: "m1", repeated: false })).handle(
      new Request("http://localhost/", { method: "POST" }),
    );
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ movementId: "m1", repeated: false });
  });
});
