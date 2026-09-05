import { afterAll, beforeAll, expect, mock, test } from "bun:test";

import { eq } from "drizzle-orm";

import { createAuth } from "@/lib/auth/create-auth";
import { db } from "@/lib/db/connection";
import { auditEntries, customerInvitations, customers, profiles, user } from "@/lib/db/schema";
import type { Actor } from "@/lib/domain/_types/domain";

type Envelope = { from: string; to: string; subject: string; text: string };
const calls: { message: Envelope; key: string }[] = [];
let failDelivery = false;
let rejectedSender = false;
mock.module("resend", () => ({
  Resend: class {
    emails = {
      send: async (message: Envelope, options: { idempotencyKey: string }) => {
        calls.push({ message: { ...message }, key: options.idempotencyKey });
        if (rejectedSender)
          return {
            data: null,
            error: {
              name: "validation_error",
              message:
                "You can only send testing emails to your own email address (private@example.test).",
            },
          };
        return failDelivery
          ? { data: null, error: { message: "Provider boundary failure" } }
          : { data: { id: `onboarding-provider-${calls.length}` }, error: null };
      },
    };
  },
}));

const { api } = await import("@/server/api");
const { createCustomerWithLogin } = await import("@/features/catalog/customer-onboarding");
const auth = createAuth(db);
const origin = new URL(Bun.env.BETTER_AUTH_URL!).origin;
const originalKey = Bun.env.RESEND_API_KEY;
const originalFrom = Bun.env.EMAIL_FROM;
const staff: Record<string, { actor: Actor; cookie: string }> = {};
const input = () => ({
  name: "Onboarding Customer",
  email: `onboarding-${crypto.randomUUID()}@example.test`,
  tier: "Gold" as const,
  team: "Enterprise",
});
function cookie(response: Response) {
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}
async function request(method: string, path: string, sessionCookie: string, body?: unknown) {
  return api.handle(
    new Request(`${origin}/api/v1${path}`, {
      method,
      headers: { origin, cookie: sessionCookie, "content-type": "application/json" },
      ...(body ? { body: JSON.stringify(body) } : {}),
    }),
  );
}
async function authRequest(path: string, body: unknown, sessionCookie = "") {
  return auth.handler(
    new Request(`${origin}/api/auth/${path}`, {
      method: "POST",
      headers: { origin, cookie: sessionCookie, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
}
function passwordFrom(message: Envelope) {
  const password = message.text.match(/^Temporary password: (.+)$/m)?.[1];
  if (!password) throw new Error("Expected temporary credential in provider envelope");
  return password;
}

beforeAll(async () => {
  if (!new URL(Bun.env.DATABASE_URL!).pathname.endsWith("_test"))
    throw new Error("Customer onboarding regression requires the isolated test database");
  Bun.env.RESEND_API_KEY = "onboarding-provider-boundary-test-key";
  Bun.env.EMAIL_FROM = "DealFlow360 <onboarding@example.test>";
  for (const role of ["rep", "manager", "admin"] as const) {
    const password = `Staff-${crypto.randomUUID()}`;
    const signup = await auth.api.signUpEmail({
      body: { email: `${role}-${crypto.randomUUID()}@example.test`, name: role, password },
    });
    await db.insert(profiles).values({ userId: signup.user.id, role });
    const login = await authRequest("sign-in/email", { email: signup.user.email, password });
    expect(login.status).toBe(200);
    staff[role] = {
      actor: { ...signup.user, role, customerId: null },
      cookie: cookie(login),
    };
  }
});

afterAll(() => {
  if (originalKey === undefined) delete Bun.env.RESEND_API_KEY;
  else Bun.env.RESEND_API_KEY = originalKey;
  if (originalFrom === undefined) delete Bun.env.EMAIL_FROM;
  else Bun.env.EMAIL_FROM = originalFrom;
});

test("provisions a customer login, preserves staff session, and enforces first password change", async () => {
  const body = input();
  const before = calls.length;
  const response = await request("POST", "/customers", staff.rep!.cookie, body);
  expect(response.status).toBe(200);
  expect(response.headers.getSetCookie()).toEqual([]);
  const created = await response.json();
  expect(created.invitation.status).toBe("SENT");
  expect(calls).toHaveLength(before + 1);
  const sent = calls[before]!;
  const temporaryPassword = passwordFrom(sent.message);
  expect(temporaryPassword.length).toBeGreaterThanOrEqual(32);
  expect(sent.message).toEqual({
    from: "DealFlow360 <onboarding@example.test>",
    to: body.email,
    subject: "Your DealFlow360 customer portal login",
    text: `Hello Onboarding Customer,\n\nYour customer portal account is ready.\nSign in: ${new URL("/login", Bun.env.BETTER_AUTH_URL!).href}\nEmail: ${body.email}\nTemporary password: ${temporaryPassword}\n\nYou must choose a new password before opening your customer portal. Do not share this password.\n\nDealFlow360`,
  });
  expect(sent.key).toBe(`customer-invitation-${created.invitation.id}`);
  const [invitation] = await db
    .select()
    .from(customerInvitations)
    .where(eq(customerInvitations.customerId, created.id));
  expect(invitation!.encryptedPayload).not.toContain(temporaryPassword);
  expect(invitation!.encryptedPayload).not.toContain(body.email);
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, invitation!.userId));
  expect(profile).toMatchObject({
    role: "customer",
    customerId: created.id,
    mustChangePassword: true,
  });
  const staffSession = await auth.api.getSession({
    headers: new Headers({ cookie: staff.rep!.cookie }),
  });
  expect(staffSession!.user.id).toBe(staff.rep!.actor.id);

  const workspace = await request("GET", "/workspace", staff.rep!.cookie);
  expect(workspace.status).toBe(200);
  const audit = await db.select().from(auditEntries).where(eq(auditEntries.entityId, created.id));
  for (const publicValue of [created, await workspace.json(), audit]) {
    const serialized = JSON.stringify(publicValue);
    expect(serialized.includes(temporaryPassword)).toBe(false);
    expect(serialized.includes(invitation!.encryptedPayload)).toBe(false);
    expect(serialized.includes("encryptedPayload")).toBe(false);
  }
  const login = await authRequest("sign-in/email", {
    email: body.email,
    password: temporaryPassword,
  });
  expect(login.status).toBe(200);
  const customerCookie = cookie(login);
  expect((await request("GET", "/portal", customerCookie)).status).toBe(403);
  const samePassword = await authRequest(
    "change-password",
    {
      currentPassword: temporaryPassword,
      newPassword: temporaryPassword,
    },
    customerCookie,
  );
  expect(samePassword.status).toBe(400);
  expect((await request("GET", "/portal", customerCookie)).status).toBe(403);
  const newPassword = `Changed-${crypto.randomUUID()}`;
  const changed = await authRequest(
    "change-password",
    {
      currentPassword: temporaryPassword,
      newPassword,
      revokeOtherSessions: true,
    },
    customerCookie,
  );
  expect(changed.status).toBe(200);
  const [updated] = await db.select().from(profiles).where(eq(profiles.userId, invitation!.userId));
  expect(updated!.mustChangePassword).toBe(false);
  const [purged] = await db
    .select()
    .from(customerInvitations)
    .where(eq(customerInvitations.id, invitation!.id));
  expect(purged!.encryptedPayload).toBe("");
  const newLogin = await authRequest("sign-in/email", { email: body.email, password: newPassword });
  expect(newLogin.status).toBe(200);
  expect((await request("GET", "/portal", cookie(newLogin))).status).toBe(200);
  expect(
    (await authRequest("sign-in/email", { email: body.email, password: temporaryPassword })).status,
  ).toBe(401);
});

test("existing staff email cannot be attached and concurrent customer creation has one winner", async () => {
  const before = calls.length;
  const conflict = await request("POST", "/customers", staff.rep!.cookie, {
    ...input(),
    email: staff.admin!.actor.email,
  });
  expect(conflict.status).toBe(409);
  const [admin] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, staff.admin!.actor.id));
  expect(admin!.role).toBe("admin");
  expect(admin!.customerId).toBeNull();
  expect(calls).toHaveLength(before);
  const body = input();
  const results = await Promise.all([
    request("POST", "/customers", staff.rep!.cookie, body),
    request("POST", "/customers", staff.manager!.cookie, body),
  ]);
  expect(results.map((result) => result.status).sort()).toEqual([200, 409]);
  expect(await db.select().from(customers).where(eq(customers.email, body.email))).toHaveLength(1);
  expect(await db.select().from(user).where(eq(user.email, body.email))).toHaveLength(1);
  expect(calls).toHaveLength(before + 1);
});

test("failed invitation persists; retry reuses its envelope and key; tier edits never send email", async () => {
  const body = input();
  const before = calls.length;
  failDelivery = true;
  let created;
  try {
    const response = await request("POST", "/customers", staff.rep!.cookie, body);
    expect(response.status).toBe(200);
    created = await response.json();
    expect(created.invitation.status).toBe("FAILED");
  } finally {
    failDelivery = false;
  }
  const [intent] = await db
    .select()
    .from(customerInvitations)
    .where(eq(customerInvitations.customerId, created.id));
  expect(intent!.attempts).toBe(1);
  expect(intent!.status).toBe("FAILED");
  expect(intent!.encryptedPayload.length).toBeGreaterThan(0);
  expect(intent!.encryptedPayload.includes(passwordFrom(calls[before]!.message))).toBe(false);
  const status = await request("GET", `/customers/${created.id}/invitation`, staff.rep!.cookie);
  expect(await status.json()).toEqual(created.invitation);
  const retry = await request(
    "POST",
    `/customers/${created.id}/invitation/retry`,
    staff.manager!.cookie,
  );
  expect(retry.status).toBe(200);
  expect((await retry.json()).status).toBe("SENT");
  expect(calls).toHaveLength(before + 2);
  expect(calls[before + 1]).toEqual(calls[before]);
  const repeat = await request(
    "POST",
    `/customers/${created.id}/invitation/retry`,
    staff.rep!.cookie,
  );
  expect(repeat.status).toBe(200);
  expect(calls).toHaveLength(before + 2);
  const edit = await request("PATCH", `/customers/${created.id}`, staff.manager!.cookie, {
    ...body,
    tier: "Silver",
  });
  expect(edit.status).toBe(200);
  expect(calls).toHaveLength(before + 2);
  const [final] = await db
    .select()
    .from(customerInvitations)
    .where(eq(customerInvitations.id, intent!.id));
  expect(final!.attempts).toBe(2);
  expect(final!.error).toBeNull();
});

test("failed provisioning transaction rolls back login, customer and invitation before email", async () => {
  const body = input();
  const before = calls.length;
  await expect(
    createCustomerWithLogin(body, {
      ...staff.rep!.actor,
      id: crypto.randomUUID(),
    }),
  ).rejects.toThrow();
  expect(await db.select().from(user).where(eq(user.email, body.email))).toHaveLength(0);
  expect(await db.select().from(customers).where(eq(customers.email, body.email))).toHaveLength(0);
  expect(
    await db
      .select()
      .from(customerInvitations)
      .where(eq(customerInvitations.recipient, body.email)),
  ).toHaveLength(0);
  expect(calls).toHaveLength(before);
});

test("test-domain rejection is actionable and private provider details never reach customer or audit responses", async () => {
  rejectedSender = true;
  try {
    const response = await request("POST", "/customers", staff.rep!.cookie, input());
    expect(response.status).toBe(200);
    const created = await response.json();
    expect(created.invitation.status).toBe("FAILED");
    expect(created.invitation.message).toContain("verified sending domain");
    expect(created.invitation.message).not.toContain("private@example.test");
    const audit = await db.select().from(auditEntries).where(eq(auditEntries.entityId, created.id));
    expect(JSON.stringify(audit)).not.toContain("private@example.test");
    const status = await request("GET", `/customers/${created.id}/invitation`, staff.rep!.cookie);
    expect(await status.json()).toEqual(created.invitation);
  } finally {
    rejectedSender = false;
  }
});
