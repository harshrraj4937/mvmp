"use client";

import { useState } from "react";

import type { AddressView } from "~/modules/orders/application/addresses";

import { stateName } from "~/modules/catalog/domain/indian-states";

import { AddressForm } from "./address-form.client";

/** The shopper's saved addresses: add, edit, delete, make default. */
export function AddressList({
  addresses: initial,
}: { addresses: AddressView[] }) {
  const [addresses, setAddresses] = useState(initial);
  const [editing, setEditing] = useState<null | string>(null);
  const [message, setMessage] = useState("");

  async function reload() {
    const response = await fetch("/api/v1/account/addresses");
    const json = (await response.json()) as { data?: AddressView[] };
    setAddresses(json.data ?? []);
  }

  async function send(id: string, method: "DELETE" | "PATCH", body?: unknown) {
    setMessage("");
    try {
      const response = await fetch(`/api/v1/account/addresses/${id}`, {
        body: body === undefined ? undefined : JSON.stringify(body),
        headers:
          body === undefined
            ? undefined
            : { "content-type": "application/json" },
        method,
      });
      if (!response.ok) {
        const json = (await response.json()) as { error?: { message: string } };
        setMessage(
          json.error?.message ?? "Something went wrong. Please try again.",
        );
        return;
      }
      await reload();
    } catch {
      setMessage("Could not reach Gillu. Check your connection and try again.");
    }
  }

  const saved = async () => {
    setEditing(null);
    await reload();
  };

  return (
    <div className="address-list">
      {addresses.length === 0 && <p>No saved addresses yet.</p>}
      <ul className="order-list">
        {addresses.map((address) => (
          <li className="cart-group" key={address.id}>
            {editing === address.id ? (
              <AddressForm
                address={address}
                onCancel={() => setEditing(null)}
                onSaved={saved}
              />
            ) : (
              <>
                <p>
                  <strong>{address.fullName}</strong>
                  {address.isDefault && <span className="tag">Default</span>}
                </p>
                <p>
                  {address.line1}
                  {address.line2 ? `, ${address.line2}` : ""}
                  {address.landmark ? `, near ${address.landmark}` : ""}
                  <br />
                  {address.city}, {stateName(address.state)}{" "}
                  {address.postalCode}
                  <br />
                  {address.phone}
                </p>
                <div className="form-actions">
                  {!address.isDefault && (
                    <button
                      className="text-button"
                      onClick={() =>
                        send(address.id, "PATCH", { isDefault: true })
                      }
                      type="button"
                    >
                      Make default
                    </button>
                  )}
                  <button
                    className="text-button"
                    onClick={() => setEditing(address.id)}
                    type="button"
                  >
                    Edit
                  </button>
                  <button
                    className="text-button"
                    onClick={() => send(address.id, "DELETE")}
                    type="button"
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </li>
        ))}
      </ul>
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      {editing === "new" ? (
        <div className="cart-group">
          <AddressForm onCancel={() => setEditing(null)} onSaved={saved} />
        </div>
      ) : (
        <button
          className="text-button"
          onClick={() => setEditing("new")}
          type="button"
        >
          Add an address
        </button>
      )}
    </div>
  );
}
