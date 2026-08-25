// Shared client-side counterpart to checkCascadeOnUpdate (src/lib/cascadeIntegrity.js). The
// four transaction update routes (transplant/service/medicine/expense) return 409 with
// { requiresLinkedUpdateConfirmation: true, message } when an amount edit would leave a linked
// Payable/Receivable's total disagreeing with the transaction that created it — until now, no
// edit form anywhere in the app ever read that shape or knew to retry with updateLinked:true, so
// every one of those edits was a silent, permanent dead end ("Failed to update transaction" with
// no way to actually save).
//
// buildBody is a function, not a plain object, because the retry needs a FRESH body with
// updateLinked:true spliced in — passing an already-serialized object would just re-send the
// same body twice.
//
// There is no partial option here: the route (checkCascadeOnUpdate) refuses the WHOLE edit —
// including every other field in the same request, not just the amount — until updateLinked is
// true. So the only two outcomes are "confirm and both totals move together" or "abandon this
// save entirely" — there is no way to keep only this transaction's new amount while leaving the
// linked document at its old total.
//
// Returns { res, data, cancelled: true } instead of retrying when the user declines, so the
// caller can distinguish "the user chose not to proceed" from "the server rejected it" and skip
// showing an error toast for a decision the user themselves made.
export async function fetchWithLinkedConfirm(url, buildBody) {
  const send = (body) =>
    fetch(url, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

  let res = await send(buildBody());
  let data = await res.json();

  if (res.status === 409 && data.requiresLinkedUpdateConfirmation) {
    const proceed = window.confirm(
      `${data.message}\n\nOK = save this edit and update the linked document's total to match.\nCancel = discard this edit (the transaction stays as it was).`,
    );
    if (!proceed) {
      return { res, data, cancelled: true };
    }
    res = await send({ ...buildBody(), updateLinked: true });
    data = await res.json();
  }

  return { res, data, cancelled: false };
}
