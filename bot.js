const TelegramBot = require('node-telegram-bot-api');
const Emailnator = require('./src/emailnator');
const config = require('./src/config');

// ===================== INIT =====================

if (!config.botToken) {
  console.error('❌ Token bot belum diisi!');
  console.error('   Buka src/config.js dan isi field botToken dengan token dari @BotFather');
  process.exit(1);
}

const bot = new TelegramBot(config.botToken, { polling: config.polling });

// In-memory store: chatId -> email
const userEmails = new Map();

// ===================== HELPERS =====================

function getEmail(chatId) {
  return userEmails.get(chatId);
}

function setEmail(chatId, email) {
  userEmails.set(chatId, email);
}

/**
 * Escape MarkdownV1 special characters in user-generated content
 * so Telegram doesn't choke on them.
 */
function escMD(text) {
  if (!text) return '';
  return String(text)
    .replace(/_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/`/g, '\\`')
    .replace(/\[/g, '\\[');
}

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return escMD(text || '*(kosong)*');
  return escMD(text.slice(0, maxLen)) + '\n\n...*(dipotong, terlalu panjang)*';
}

function formatInbox(inbox) {
  if (inbox.totalEmails === 0) return config.messages.emptyInbox;
  const lines = [`📬 *${inbox.totalEmails} pesan* di inbox:\n`];
  inbox.emails.forEach((m, i) => {
    lines.push(
      `${i + 1}. *${escMD(m.subject || '(no subject)')}*` +
        `\n   Dari: ${escMD(m.from || '?')}` +
        `\n   /read_${m.id}`
    );
  });
  return lines.join('\n\n');
}

// ===================== COMMANDS =====================

bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    `<b>Halo! 👋 Aku Emailnator Bot.</b>\n\n` +
      `Aku bisa bantu kamu bikin <b>email sementara</b> dan cek <b>inbox</b> langsung dari Telegram.\n\n` +
      `<b>📋 Perintah:</b>\n` +
      `  /new — Buat email baru\n` +
      `  /inbox — Cek inbox email kamu\n` +
      `  /read_id — Baca detail isi pesan (ganti <code>id</code> dengan ID pesan)\n\n` +
      `Coba /new dulu yuk! 🚀`,
    { parse_mode: 'HTML' }
  );
});

bot.onText(/^\/new$/, async (msg) => {
  const chatId = msg.chat.id;
  const status = await bot.sendMessage(chatId, config.messages.creating);
  try {
    const e = new Emailnator();
    const result = await e.create();
    setEmail(chatId, result.email);
    await bot.editMessageText(
      `✅ <b>Email berhasil dibuat!</b>\n\n📧 <code>${result.email}</code>\n\nGunakan /inbox untuk cek pesan masuk.`,
      { chat_id: chatId, message_id: status.message_id, parse_mode: 'HTML' }
    );
  } catch (err) {
    await bot.editMessageText(`❌ Gagal: ${err.message}`, {
      chat_id: chatId,
      message_id: status.message_id,
    });
  }
});

bot.onText(/^\/inbox$/, async (msg) => {
  const chatId = msg.chat.id;
  const email = getEmail(chatId);
  if (!email) return bot.sendMessage(chatId, config.messages.noEmail);

  const status = await bot.sendMessage(chatId, config.messages.checking(email));
  try {
    const e = new Emailnator();
    const inbox = await e.getInbox(email);
    await bot.editMessageText(`📧 ${email}\n\n${formatInbox(inbox)}`, {
      chat_id: chatId,
      message_id: status.message_id,
      parse_mode: 'Markdown',
    });
  } catch (err) {
    await bot.editMessageText(`❌ Gagal cek inbox: ${err.message}`, {
      chat_id: chatId,
      message_id: status.message_id,
    });
  }
});

bot.onText(/^\/read_(.+)$/, async (msg, match) => {
  const chatId = msg.chat.id;
  const messageId = match[1].trim();
  const email = getEmail(chatId);
  if (!email) return bot.sendMessage(chatId, config.messages.noEmail);

  const status = await bot.sendMessage(chatId, config.messages.reading);
  try {
    const e = new Emailnator();
    const message = await e.getMessage(email, messageId);
    const content = truncate(message.text, config.messages.maxContentLength);
    await bot.editMessageText(
      `<b>📩 Pesan</b>\n` +
        `ID: <code>${message.id}</code>\n` +
        `Dari: ${escMD(message.from)}\n` +
        `Subjek: ${escMD(message.subject)}\n` +
        `Waktu: ${escMD(message.time || '?')}\n\n${content}`,
      { chat_id: chatId, message_id: status.message_id, parse_mode: 'HTML' }
    );
  } catch (err) {
    await bot.editMessageText(`❌ Gagal baca pesan: ${err.message}`, {
      chat_id: chatId,
      message_id: status.message_id,
    });
  }
});

// ===================== START =====================

bot.on('polling_error', (err) => {
  console.error('⚠️ Polling error:', err.message);
});

console.log('🤖 Emailnator Bot is running...');
console.log('   Mode: polling');

module.exports = bot;
