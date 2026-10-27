"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { MerchantStatus } from "~/modules/merchants/domain/status";

import { fieldErrors, sendJson } from "~/lib/api-client";
import { Button } from "~/ui/primitives/button";
import { Label } from "~/ui/primitives/label";

type Action = "approve" | "reinstate" | "reject" | "suspend";

export function ReviewActions({
  merchantId,
  status,
}: {
  merchantId: string;
  status: MerchantStatus;
}) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const act = async (action: Action) => {
    setBusy(true);
    setError("");
    const result = await sendJson(
      `/api/v1/admin/merchants/${merchantId}/${action}`,
      "POST",
      action === "reject" ? { reason } : undefined,
    );
    setBusy(false);
    if (result.error) {
      setError(fieldErrors(result.error).reason ?? result.error.message);
      return;
    }
    router.refresh();
  };

  if (status === "DRAFT" || status === "REJECTED") {
    return (
      <p className="text-sm text-muted-foreground">
        Waiting for the merchant to submit the shop for review.
      </p>
    );
  }

  return (
    <div className="grid gap-3 rounded-md border p-4">
      {status === "SUBMITTED" && (
        <>
          <div className="flex gap-3">
            <Button disabled={busy} onClick={() => void act("approve")}>
              Approve
            </Button>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="reject-reason">
              Reason for rejection (shown to the merchant)
            </Label>
            <textarea
              className={`
                min-h-20 rounded-md border bg-transparent px-3 py-2 text-sm
              `}
              id="reject-reason"
              maxLength={500}
              onChange={(event) => {
                setReason(event.target.value);
              }}
              value={reason}
            />
            <div>
              <Button
                disabled={busy}
                onClick={() => void act("reject")}
                variant="destructive"
              >
                Reject
              </Button>
            </div>
          </div>
        </>
      )}
      {status === "APPROVED" && (
        <div>
          <Button
            disabled={busy}
            onClick={() => void act("suspend")}
            variant="destructive"
          >
            Suspend
          </Button>
        </div>
      )}
      {status === "SUSPENDED" && (
        <div>
          <Button disabled={busy} onClick={() => void act("reinstate")}>
            Reinstate
          </Button>
        </div>
      )}
      {error && (
        <p className="text-sm font-medium text-destructive" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
