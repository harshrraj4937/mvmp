import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, inArray } from "drizzle-orm";

import type { Database } from "~/db";

import { cartItemsTable, cartsTable } from "~/db/schema";
import { getVariantsForCart } from "~/modules/catalog/application/storefront";
import { ConflictError, NotFoundError } from "~/platform/errors";

import { MAX_CART_LINES, MAX_LINE_QUANTITY } from "../domain/constants";
import { type LineStatus, lineStatus } from "../domain/line-status";
import { hashGuestToken, newGuestToken } from "../presentation/guest-cookie";

/** `clear` removes the guest cookie; `set` writes the token; null leaves it. */
export type CartCookie = null | { clear: true } | { set: string };
export interface CartGroupView {
  lines: CartLineView[];
  shopLinkable: boolean;
  shopSlug: string;
  storeName: string;
  subtotalPaise: number;
}

export interface CartLineView {
  available: number;
  coverImageUrl: null | string;
  productName: string;
  productSlug: string;
  quantity: number;
  seenPricePaise: number;
  status: LineStatus;
  unitPricePaise: number;
  variantId: string;
  variantLabel: null | string;
}

export interface CartOwner {
  guestToken: null | string;
  userId: null | string;
}

export interface CartResult {
  cookie: CartCookie;
  view: CartView;
}

export interface CartView {
  canCheckout: boolean;
  count: number;
  groups: CartGroupView[];
  /** Guest lines dropped by the merge in this call (only this call's view). */
  mergeDropped: number;
  totalPaise: number;
}

type Executor = Database | Transaction;

/**
 * What a call may do with the cart. `read` never creates a cart. `touch`
 * updates an existing guest cart (refreshing its cookie) but never creates
 * one. `create` makes the cart when there is none.
 */
type Mode = "create" | "read" | "touch";

interface Prepared {
  cartId: null | string;
  cookie: CartCookie;
  mergeDropped: number;
}

type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

const EMPTY_VIEW: CartView = {
  canCheckout: false,
  count: 0,
  groups: [],
  mergeDropped: 0,
  totalPaise: 0,
};

export async function addCartItem(
  db: Database,
  owner: CartOwner,
  input: { quantity: number; variantId: string },
): Promise<CartResult> {
  const prepared = await prepare(db, owner, "create");
  const cartId = requireCart(prepared);
  const [info] = await getVariantsForCart(db, [input.variantId]);
  if (!info) {
    throw new NotFoundError("Product not found.");
  }
  if (!info.purchasable) {
    throw new ConflictError(
      "not_purchasable",
      "This item is not available right now.",
    );
  }
  await db.transaction(async (tx) => {
    await lockCart(tx, cartId);
    const lines = await tx
      .select({
        id: cartItemsTable.id,
        quantity: cartItemsTable.quantity,
        variantId: cartItemsTable.variantId,
      })
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cartId, cartId));
    const existing = lines.find((line) => line.variantId === input.variantId);
    if (!existing && lines.length >= MAX_CART_LINES) {
      throw new ConflictError(
        "cart_full",
        `Your cart can hold ${MAX_CART_LINES} different items.`,
      );
    }
    const total = (existing?.quantity ?? 0) + input.quantity;
    if (total > MAX_LINE_QUANTITY) {
      throw new ConflictError(
        "line_full",
        `You can order up to ${MAX_LINE_QUANTITY} of each item.`,
      );
    }
    if (total > info.available) {
      throw stockError(info.available);
    }
    if (existing) {
      await tx
        .update(cartItemsTable)
        .set({ quantity: total })
        .where(eq(cartItemsTable.id, existing.id));
      return;
    }
    await tx.insert(cartItemsTable).values({
      cartId,
      id: createId(),
      quantity: total,
      unitPricePaiseSeen: info.pricePaise,
      variantId: input.variantId,
    });
  });
  return finish(db, prepared);
}

export async function getCart(
  db: Database,
  owner: CartOwner,
): Promise<CartResult> {
  const prepared = await prepare(db, owner, "read");
  return finish(db, prepared);
}

export async function removeCartItem(
  db: Database,
  owner: CartOwner,
  variantId: string,
): Promise<CartResult> {
  const prepared = await prepare(db, owner, "touch");
  const cartId = prepared.cartId;
  if (!cartId) {
    throw notInCart();
  }
  await db.transaction(async (tx) => {
    await lockCart(tx, cartId);
    const removed = await tx
      .delete(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.cartId, cartId),
          eq(cartItemsTable.variantId, variantId),
        ),
      )
      .returning({ id: cartItemsTable.id });
    if (removed.length === 0) {
      throw notInCart();
    }
  });
  return finish(db, prepared);
}

/** A new quantity, or acknowledges the current price. 404 if not in the cart. */
export async function updateCartItem(
  db: Database,
  owner: CartOwner,
  variantId: string,
  change: { acknowledgePrice: true } | { quantity: number },
): Promise<CartResult> {
  const prepared = await prepare(db, owner, "touch");
  const cartId = prepared.cartId;
  if (!cartId) {
    throw notInCart();
  }
  const [info] = await getVariantsForCart(db, [variantId]);
  await db.transaction(async (tx) => {
    await lockCart(tx, cartId);
    const [line] = await tx
      .select({ id: cartItemsTable.id })
      .from(cartItemsTable)
      .where(
        and(
          eq(cartItemsTable.cartId, cartId),
          eq(cartItemsTable.variantId, variantId),
        ),
      );
    if (!line || !info) {
      throw notInCart();
    }
    if ("acknowledgePrice" in change) {
      await tx
        .update(cartItemsTable)
        .set({ unitPricePaiseSeen: info.pricePaise })
        .where(eq(cartItemsTable.id, line.id));
      return;
    }
    if (!info.purchasable) {
      throw new ConflictError(
        "not_purchasable",
        "This item is not available right now.",
      );
    }
    if (change.quantity > info.available) {
      throw stockError(info.available);
    }
    await tx
      .update(cartItemsTable)
      .set({ quantity: change.quantity })
      .where(eq(cartItemsTable.id, line.id));
  });
  return finish(db, prepared);
}

async function createGuestCart(db: Database): Promise<Prepared> {
  const token = newGuestToken();
  const id = createId();
  await db
    .insert(cartsTable)
    .values({ guestTokenHash: hashGuestToken(token), id });
  return { cartId: id, cookie: { set: token }, mergeDropped: 0 };
}

async function ensureUserCart(db: Executor, userId: string): Promise<string> {
  const existing = await findUserCart(db, userId);
  if (existing) {
    return existing;
  }
  await db
    .insert(cartsTable)
    .values({ id: createId(), userId })
    .onConflictDoNothing({ target: cartsTable.userId });
  const cartId = await findUserCart(db, userId);
  if (!cartId) {
    throw new Error("The user's cart is missing after insert.");
  }
  return cartId;
}

async function findCartByHash(
  db: Executor,
  hash: string,
): Promise<null | string> {
  const [row] = await db
    .select({ id: cartsTable.id })
    .from(cartsTable)
    .where(eq(cartsTable.guestTokenHash, hash));
  return row?.id ?? null;
}

async function findUserCart(
  db: Executor,
  userId: string,
): Promise<null | string> {
  const [row] = await db
    .select({ id: cartsTable.id })
    .from(cartsTable)
    .where(eq(cartsTable.userId, userId));
  return row?.id ?? null;
}

async function finish(db: Database, prepared: Prepared): Promise<CartResult> {
  return {
    cookie: prepared.cookie,
    view: await viewFor(db, prepared.cartId, prepared.mergeDropped),
  };
}

async function lockCart(tx: Transaction, cartId: string): Promise<void> {
  await tx
    .select({ id: cartsTable.id })
    .from(cartsTable)
    .where(eq(cartsTable.id, cartId))
    .for("update");
}

/**
 * Moves a guest cart into the user's cart in one transaction. Quantities add
 * and cap at the line limit; guest lines past the cart's line limit are
 * dropped. Returns how many were dropped.
 */
async function mergeGuestCart(
  db: Database,
  userId: string,
  guestId: string,
): Promise<number> {
  return db.transaction(async (tx) => {
    const userCartId = await ensureUserCart(tx, userId);
    await tx
      .select({ id: cartsTable.id })
      .from(cartsTable)
      .where(inArray(cartsTable.id, [userCartId, guestId]))
      .orderBy(asc(cartsTable.id))
      .for("update");

    const guestLines = await tx
      .select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cartId, guestId))
      .orderBy(asc(cartItemsTable.createdAt), asc(cartItemsTable.id));
    const userLines = await tx
      .select()
      .from(cartItemsTable)
      .where(eq(cartItemsTable.cartId, userCartId));
    const byVariant = new Map(userLines.map((line) => [line.variantId, line]));
    let count = userLines.length;
    let dropped = 0;

    for (const guest of guestLines) {
      const existing = byVariant.get(guest.variantId);
      if (existing) {
        await tx
          .update(cartItemsTable)
          .set({
            quantity: Math.min(
              MAX_LINE_QUANTITY,
              existing.quantity + guest.quantity,
            ),
          })
          .where(eq(cartItemsTable.id, existing.id));
        continue;
      }
      if (count >= MAX_CART_LINES) {
        dropped += 1;
        continue;
      }
      count += 1;
      await tx.insert(cartItemsTable).values({
        cartId: userCartId,
        id: createId(),
        quantity: Math.min(MAX_LINE_QUANTITY, guest.quantity),
        unitPricePaiseSeen: guest.unitPricePaiseSeen,
        variantId: guest.variantId,
      });
    }

    await tx.delete(cartsTable).where(eq(cartsTable.id, guestId));
    return dropped;
  });
}

function notInCart(): NotFoundError {
  return new NotFoundError("Item not in your cart.");
}

/**
 * Resolves the cart for this call. A signed-in user with a guest cookie first
 * merges that guest cart into theirs; the cookie is then cleared.
 */
async function prepare(
  db: Database,
  owner: CartOwner,
  mode: Mode,
): Promise<Prepared> {
  if (owner.userId) {
    let mergeDropped = 0;
    let cookie: CartCookie = null;
    if (owner.guestToken) {
      const guest = await findCartByHash(db, hashGuestToken(owner.guestToken));
      if (guest) {
        mergeDropped = await mergeGuestCart(db, owner.userId, guest);
      }
      cookie = { clear: true };
    }
    const cartId =
      mode === "create"
        ? await ensureUserCart(db, owner.userId)
        : await findUserCart(db, owner.userId);
    return { cartId, cookie, mergeDropped };
  }

  if (owner.guestToken === null) {
    return mode === "create"
      ? createGuestCart(db)
      : { cartId: null, cookie: null, mergeDropped: 0 };
  }
  const found = await findCartByHash(db, hashGuestToken(owner.guestToken));
  if (found) {
    return {
      cartId: found,
      cookie: mode === "read" ? null : { set: owner.guestToken },
      mergeDropped: 0,
    };
  }
  if (mode !== "create") {
    return { cartId: null, cookie: { clear: true }, mergeDropped: 0 };
  }
  return createGuestCart(db);
}

function requireCart(prepared: Prepared): string {
  if (!prepared.cartId) {
    throw new Error("A write must have a cart.");
  }
  return prepared.cartId;
}

function stockError(available: number): ConflictError {
  return new ConflictError(
    "insufficient_stock",
    available === 0 ? "This item is sold out." : `Only ${available} left.`,
    { available },
  );
}

async function viewFor(
  db: Executor,
  cartId: null | string,
  mergeDropped: number,
): Promise<CartView> {
  if (!cartId) {
    return { ...EMPTY_VIEW, mergeDropped };
  }
  const items = await db
    .select({
      quantity: cartItemsTable.quantity,
      unitPricePaiseSeen: cartItemsTable.unitPricePaiseSeen,
      variantId: cartItemsTable.variantId,
    })
    .from(cartItemsTable)
    .where(eq(cartItemsTable.cartId, cartId))
    .orderBy(asc(cartItemsTable.createdAt), asc(cartItemsTable.id));
  const infos = await getVariantsForCart(
    db,
    items.map((item) => item.variantId),
  );
  const byVariant = new Map(infos.map((info) => [info.variantId, info]));

  const groups = new Map<string, CartGroupView>();
  const lines: CartLineView[] = [];
  for (const item of items) {
    const info = byVariant.get(item.variantId);
    if (!info) {
      continue;
    }
    const status = lineStatus({
      available: info.available,
      currentPricePaise: info.pricePaise,
      purchasable: info.purchasable,
      quantity: item.quantity,
      seenPricePaise: item.unitPricePaiseSeen,
    });
    const line: CartLineView = {
      available: info.available,
      coverImageUrl: info.coverImageUrl,
      productName: info.productName,
      productSlug: info.productSlug,
      quantity: item.quantity,
      seenPricePaise: item.unitPricePaiseSeen,
      status,
      unitPricePaise: info.pricePaise,
      variantId: info.variantId,
      variantLabel: info.variantLabel,
    };
    lines.push(line);
    let group = groups.get(info.merchantId);
    if (!group) {
      group = {
        lines: [],
        shopLinkable: info.shopLinkable,
        shopSlug: info.shopSlug,
        storeName: info.storeName,
        subtotalPaise: 0,
      };
      groups.set(info.merchantId, group);
    }
    group.lines.push(line);
    if (status === "ok" || status === "price_changed") {
      group.subtotalPaise += info.pricePaise * item.quantity;
    }
  }

  const list = [...groups.values()];
  return {
    canCheckout:
      lines.length > 0 && lines.every((line) => line.status === "ok"),
    count: lines.reduce((sum, line) => sum + line.quantity, 0),
    groups: list,
    mergeDropped,
    totalPaise: list.reduce((sum, group) => sum + group.subtotalPaise, 0),
  };
}
