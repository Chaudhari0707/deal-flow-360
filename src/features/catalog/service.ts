import { eq, inArray } from "drizzle-orm";

import type {
  CatalogCustomerInput,
  CatalogProductInput,
  CatalogSettingInput,
} from "@/features/catalog/_types/catalog";
import { databaseErrorCode } from "@/features/catalog/customer-lifecycle";
import { db } from "@/lib/db/connection";
import { customers, products, profiles, settings } from "@/lib/db/schema";
import { session, user } from "@/lib/db/schema/auth";
import type { Actor } from "@/lib/domain/_types/domain";
import { audit } from "@/server/audit";
import { DomainError } from "@/server/errors";

export async function saveCatalogProduct(
  input: CatalogProductInput,
  actor: Actor,
  productId?: string,
) {
  if (input.stockable && input.intervalMonths > 0)
    throw new DomainError("Recurring plans are not stockable");
  return db.transaction(async (tx) => {
    const pairedProductIds = input.pairedProductIds ?? [];
    if (new Set(pairedProductIds).size !== pairedProductIds.length)
      throw new DomainError("Choose each upsell product only once");
    if (productId && pairedProductIds.includes(productId))
      throw new DomainError("A product cannot be its own upsell");
    if (pairedProductIds.length) {
      const matched = await tx
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.id, pairedProductIds));
      if (matched.length !== pairedProductIds.length)
        throw new DomainError("Choose upsell products from the catalog");
    }
    const productInput = { ...input, pairedProductIds };
    if (!productId) {
      const [product] = await tx
        .insert(products)
        .values({ id: crypto.randomUUID(), ...productInput })
        .returning();
      await audit(tx, actor, product!.id, "PRODUCT_CREATED", "Catalog product created");
      return product;
    }
    const [product] = await tx
      .update(products)
      .set(productInput)
      .where(eq(products.id, productId))
      .returning();
    if (!product) throw new DomainError("Product not found", 404);
    await audit(
      tx,
      actor,
      product.id,
      "PRODUCT_UPDATED",
      "Catalog configuration changed",
      productInput,
    );
    return product;
  });
}

export async function saveCatalogCustomer(
  input: CatalogCustomerInput,
  actor: Actor,
  customerId: string,
) {
  const roles = ["manager", "admin"];
  if (!roles.includes(actor.role)) throw new DomainError("Your role cannot change customers", 403);
  input = { ...input, name: input.name.trim(), email: input.email.trim().toLowerCase() };
  try {
    return await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(customers)
        .where(eq(customers.id, customerId))
        .for("update");
      if (!existing) throw new DomainError("Customer not found", 404);
      if (existing.email !== input.email) {
        const linked = await tx.select().from(profiles).where(eq(profiles.customerId, customerId));
        if (linked.length > 1 || linked.some((profile) => profile.role !== "customer"))
          throw new DomainError(
            "This customer has multiple or non-customer logins. Contact an administrator before changing the email.",
            409,
          );
        if (linked[0]) {
          await tx
            .update(user)
            .set({ email: input.email, name: input.name, emailVerified: false })
            .where(eq(user.id, linked[0].userId));
          await tx.delete(session).where(eq(session.userId, linked[0].userId));
        }
      }
      const [customer] = await tx
        .update(customers)
        .set(input)
        .where(eq(customers.id, customerId))
        .returning();
      if (!customer) throw new DomainError("Customer not found", 404);
      await audit(
        tx,
        actor,
        customer.id,
        "CUSTOMER_UPDATED",
        "Customer tier/contact updated",
        input,
      );
      return customer;
    });
  } catch (error) {
    if (databaseErrorCode(error) === "23505")
      throw new DomainError("That email is already used by another login.", 409);
    throw error;
  }
}

const allowedSettings: Record<string, string[]> = {
  discounts: [
    "Bronze",
    "Silver",
    "Gold",
    "Hardware",
    "Services",
    "Subscription",
    "highLineBps",
    "highTotalBps",
  ],
  health: ["staleDays", "approvalDays", "overdueDays", "anomalyBps", "historyDays"],
  pricelists: ["Bronze", "Silver", "Gold"],
  approvalChain: ["manager", "finance"],
};

function validateSetting(settingId: string, input: CatalogSettingInput) {
  if (
    !allowedSettings[settingId] ||
    Object.keys(input.value).some((key) => !allowedSettings[settingId]!.includes(key))
  )
    throw new DomainError("Unsupported setting");
  if (
    Object.values(input.value).some(
      (value) => !Number.isInteger(value) || value < 0 || value > 10_000,
    )
  )
    throw new DomainError("Settings must be integers from 0 to 10,000");
  if (settingId === "health") {
    const maxima: Record<string, number> = {
      staleDays: 90,
      approvalDays: 60,
      overdueDays: 60,
      historyDays: 365,
    };
    for (const [key, max] of Object.entries(maxima))
      if (input.value[key] !== undefined && (input.value[key]! < 1 || input.value[key]! > max))
        throw new DomainError(`${key} must be from 1 to ${max}`);
  }
  if (
    settingId === "discounts" &&
    ((input.value.highLineBps ?? 1) < 1 || (input.value.highTotalBps ?? 1) < 1)
  )
    throw new DomainError("Risk thresholds must be positive");
  if (settingId === "approvalChain") {
    const roles = Object.entries(input.value).filter(([role]) =>
      ["manager", "finance"].includes(role),
    );
    const activeRanks = roles.map(([, rank]) => rank).filter((rank) => rank > 0);
    if (
      !activeRanks.length ||
      roles.some(([, rank]) => rank < 0) ||
      new Set(activeRanks).size !== activeRanks.length
    )
      throw new DomainError(
        "Approval chain needs one or more unique positive ranks; use 0 to disable a role",
      );
  }
}

export async function saveCatalogSetting(
  settingId: string,
  input: CatalogSettingInput,
  actor: Actor,
) {
  validateSetting(settingId, input);
  return db.transaction(async (tx) => {
    const [current] = await tx
      .select()
      .from(settings)
      .where(eq(settings.id, settingId))
      .for("update");
    const value = { ...current?.value, ...input.value };
    await tx
      .insert(settings)
      .values({ id: settingId, value })
      .onConflictDoUpdate({ target: settings.id, set: { value } });
    await audit(tx, actor, settingId, "SETTINGS_UPDATED", "Business policy updated", value);
    return { id: settingId, value };
  });
}
