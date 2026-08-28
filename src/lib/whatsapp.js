
const WA_API_VERSION = "v21.0";

function getAdminNumbers() {
  return (process.env.ADMIN_WHATSAPP_NUMBERS || "")
    .split(",")
    .map((n) => n.trim())
    .filter(Boolean);
}

async function callWhatsAppAPI(payload) {
  const phoneId = process.env.WA_PHONE_ID;
  const accessToken = process.env.WA_ACCESS_TOKEN;
  if (!phoneId || !accessToken) {
    console.error("WhatsApp send skipped: WA_PHONE_ID or WA_ACCESS_TOKEN not configured");
    return null;
  }

  try {
    const res = await fetch(`https://graph.facebook.com/${WA_API_VERSION}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ messaging_product: "whatsapp", ...payload }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
      console.error("WhatsApp API error:", res.status, data);
      return null;
    }
    return data;
  } catch (error) {
    console.error("WhatsApp API request failed:", error);
    return null;
  }
}

export async function sendWhatsAppText(to, text) {
  return callWhatsAppAPI({
    to,
    type: "text",
    text: { body: text },
  });
}

const formatCurrency = (amount) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);

function buildApprovalBody(transaction) {
  const payee =
    transaction.expenseGiver?.type === "VENDOR"
      ? transaction.expenseGiver?.name
      : transaction.expenseGiver?.name || "N/A";

  return (
    `🧾 *New Expense Approval Needed*\n\n` +
    `Category: ${transaction.expense || "N/A"}\n` +
    `Type: ${transaction.expenseType || "N/A"}\n` +
    `Paid To: ${payee}\n` +
    `Amount: ${formatCurrency(transaction.amount)}\n` +
    `Branch: ${transaction.branch || "N/A"}\n` +
    `Method: ${(transaction.method || "N/A").replace(/_/g, " ").toUpperCase()}\n` +
    `Submitted By: ${transaction.createdBy?.name || "N/A"}\n\n` +
    `Approve or reject this expense:`
  );
}

export async function sendExpenseApprovalRequest(transaction) {
  const admins = getAdminNumbers();
  if (admins.length === 0) {
    console.error("WhatsApp approval request skipped: ADMIN_WHATSAPP_NUMBERS not configured");
    return [];
  }

  const transactionId = transaction._id.toString();
  const body = buildApprovalBody(transaction);

  const results = await Promise.allSettled(
    admins.map((phone) =>
      callWhatsAppAPI({
        to: phone,
        type: "interactive",
        interactive: {
          type: "button",
          body: { text: body },
          action: {
            buttons: [
              { type: "reply", reply: { id: `EXPAPPR:${transactionId}:APPROVE`, title: "✅ Approve" } },
              { type: "reply", reply: { id: `EXPAPPR:${transactionId}:REJECT`, title: "❌ Reject" } },
            ],
          },
        },
      }).then((data) => ({ phone, data })),
    ),
  );

  const sent = [];
  for (const result of results) {
    if (result.status === "fulfilled" && result.value?.data?.messages?.[0]?.id) {
      sent.push({ phone: result.value.phone, messageId: result.value.data.messages[0].id });
    } else if (result.status === "rejected") {
      console.error("Failed to send expense approval request:", result.reason);
    }
  }
  return sent;
}

export async function notifyOtherAdmins(transaction, actingPhone, action) {
  const admins = getAdminNumbers();
  const others = admins.filter((phone) => phone !== actingPhone);
  if (others.length === 0) return;

  const payee = transaction.expenseGiver?.name || "N/A";
  const verb = action === "APPROVED" ? "approved" : "rejected";
  const text =
    `ℹ️ The expense of ${formatCurrency(transaction.amount)} to ${payee} (${transaction.expense || "N/A"}) ` +
    `has already been ${verb} by another admin.`;

  await Promise.allSettled(others.map((phone) => sendWhatsAppText(phone, text)));
}

export { getAdminNumbers };
