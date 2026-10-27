import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uniqueIndex,
} from "drizzle-orm/pg-core";

import type { PostalAddress } from "../../../modules/merchants/presentation/schemas";

import { MERCHANT_STATUSES } from "../../../modules/merchants/domain/status";
import { userTable } from "../users/tables";

export const merchantStatusEnum = pgEnum("merchant_status", MERCHANT_STATUSES);

export const merchantMemberRoleEnum = pgEnum("merchant_member_role", [
  "owner",
  "staff",
]);

const createdAt = () =>
  timestamp("created_at", { withTimezone: true }).defaultNow().notNull();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull();

export const merchantsTable = pgTable(
  "merchants",
  {
    businessAddress: jsonb("business_address").$type<PostalAddress>().notNull(),
    complianceNotes: text("compliance_notes"),
    // Null until Gillu confirms the registrations this merchant needs.
    complianceVerifiedAt: timestamp("compliance_verified_at", {
      withTimezone: true,
    }),
    contactEmail: text("contact_email").notNull(),
    contactName: text("contact_name").notNull(),
    contactPhone: text("contact_phone").notNull(),
    createdAt: createdAt(),
    description: text("description"),
    fssaiLicense: text("fssai_license"),
    gstin: text("gstin"),
    id: text("id").primaryKey(),
    logoUrl: text("logo_url"),
    pan: text("pan"),
    rejectionReason: text("rejection_reason"),
    returnAddress: jsonb("return_address").$type<PostalAddress>().notNull(),
    reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
    reviewedBy: text("reviewed_by").references(() => userTable.id, {
      onDelete: "set null",
    }),
    slug: text("slug").notNull().unique(),
    status: merchantStatusEnum("status").default("DRAFT").notNull(),
    storeName: text("store_name").notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    updatedAt: updatedAt(),
  },
  (table) => [index("merchants_status_idx").on(table.status)],
);

export const merchantMembersTable = pgTable(
  "merchant_members",
  {
    createdAt: createdAt(),
    id: text("id").primaryKey(),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchantsTable.id, { onDelete: "cascade" }),
    role: merchantMemberRoleEnum("role").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => userTable.id, { onDelete: "cascade" }),
  },
  (table) => [
    unique("merchant_members_merchant_user_unique").on(
      table.merchantId,
      table.userId,
    ),
    index("merchant_members_user_id_idx").on(table.userId),
    // MVP: a user owns at most one shop (ADR-023); also stops double submits.
    uniqueIndex("merchant_members_one_owned_per_user")
      .on(table.userId)
      .where(sql`${table.role} = 'owner'`),
  ],
);

export const merchantPickupLocationsTable = pgTable(
  "merchant_pickup_locations",
  {
    city: text("city").notNull(),
    contactName: text("contact_name").notNull(),
    createdAt: createdAt(),
    id: text("id").primaryKey(),
    isPrimary: boolean("is_primary").default(false).notNull(),
    label: text("label").notNull(),
    line1: text("line1").notNull(),
    line2: text("line2"),
    merchantId: text("merchant_id")
      .notNull()
      .references(() => merchantsTable.id, { onDelete: "cascade" }),
    phone: text("phone").notNull(),
    postalCode: text("postal_code").notNull(),
    // Shiprocket pickup location name, registered in Phase 7.
    providerLocationName: text("provider_location_name"),
    state: text("state").notNull(),
    updatedAt: updatedAt(),
  },
  (table) => [
    check(
      "merchant_pickup_locations_postal_code_check",
      sql`${table.postalCode} ~ '^[1-9][0-9]{5}$'`,
    ),
    index("merchant_pickup_locations_merchant_id_idx").on(table.merchantId),
    uniqueIndex("merchant_pickup_locations_one_primary")
      .on(table.merchantId)
      .where(sql`${table.isPrimary}`),
  ],
);
