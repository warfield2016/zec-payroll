// telegram.js — send notifications via Telegram Bot API

const API_BASE = 'https://api.telegram.org/bot';
const TOKEN_RE = /^\d+:[A-Za-z0-9_-]+$/;

function validateToken(token) {
  if (!token || !TOKEN_RE.test(token)) {
    return { ok: false, error: 'Invalid bot token format' };
  }
  return null;
}

async function sendMessage(botToken, chatId, text) {
  if (!botToken || !chatId) return { ok: false, error: 'Missing bot token or chat ID' };

  const invalid = validateToken(botToken);
  if (invalid) return invalid;

  try {
    const url = `${API_BASE}${botToken}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10_000),
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => 'unknown error');
      return { ok: false, error: `Telegram API ${res.status}: ${body}` };
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: `Telegram request failed: ${e.message}` };
  }
}

async function notifyBatchSent(botToken, chatId, batch) {
  const lines = [
    `*ZEC Payroll — Batch Sent*`,
    ``,
    `Recipients: ${batch.recipientCount}`,
    `Total: ${Number(batch.totalZec).toFixed(8).replace(/\.?0+$/, '')} ZEC`,
    `Type: ${batch.isTest ? 'Test' : 'Full payout'}`,
    `Date: ${new Date(batch.createdAt).toLocaleDateString()}`,
  ];
  return sendMessage(botToken, chatId, lines.join('\n'));
}

async function notifyUpcomingPayout(botToken, chatId, daysLeft, recipientCount) {
  const lines = [
    `*ZEC Payroll — Payout Reminder*`,
    ``,
    daysLeft === 0
      ? `Payout is due *today*.`
      : `Payout is due in *${daysLeft} day${daysLeft === 1 ? '' : 's'}*.`,
    `Recipients: ${recipientCount}`,
  ];
  return sendMessage(botToken, chatId, lines.join('\n'));
}

async function testConnection(botToken, chatId) {
  return sendMessage(botToken, chatId, 'ZEC Payroll connected.');
}

module.exports = { sendMessage, notifyBatchSent, notifyUpcomingPayout, testConnection };
