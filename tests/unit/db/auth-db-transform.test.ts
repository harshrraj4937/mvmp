import { describe, expect, test } from "vitest";

import { stripGeneratedRelations } from "~/lib/auth-db-transform";

const generated = `import { relations } from "drizzle-orm";
import { pgTable, text } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
});

export const userRelations = relations(user, ({ many }) => ({
  sessions: many(session),
}));

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
});

export const sessionRelations = relations(session, ({ one }) => ({
  user: one(user, {
    fields: [session.userId],
    references: [user.id],
  }),
}));
`;

describe("stripGeneratedRelations", () => {
  test("removes every relations block and import but keeps every table", () => {
    const result = stripGeneratedRelations(generated);

    expect(result).not.toContain("relations");
    expect(result).toContain('export const user = pgTable("user"');
    expect(result).toContain('export const session = pgTable("session"');
    expect(result).toContain('userId: text("user_id").notNull(),');
  });

  test("refuses output it cannot fully strip instead of dropping tables", () => {
    const unknownShape = generated.replace(
      "export const sessionRelations = relations(",
      "export const sessionRelations = defineRelations(relations, ",
    );

    expect(() => stripGeneratedRelations(unknownShape)).toThrow(
      /unexpected relations output/,
    );
  });
});
