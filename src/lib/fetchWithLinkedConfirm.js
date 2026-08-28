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
