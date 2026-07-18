const TelegramBot = require('node-telegram-bot-api');
const Emailnator = require('./src/emailnator');
const config = require('./src/config');
const cheerio = require('cheerio');

// ===================== INIT =====================

if (!config.botToken) {
  console.error('❌ BOT_TOKEN tidak ditemukan!');
  console.error('   Set environment variable BOT_TOKEN atau isi di src/config.js');
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

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return text || '*(kosong)*';
  return text.slice(0, maxLen) + '\n\n...*(dipotong, terlalu panjang)*';
}

function formatInbox(chatId, inbox) {
  if (inbox.totalEmails === 0) return config.messages.emptyInbox;
  const lines = [`📬 *${inbox.totalEmails} pesan* di inbox:\n`];
  inbox.emails.forEach((m, i) => {
    lines.push(
      `${i + 1}. *${m.subject || '(no subject)'}*` +
        `\n   Dari: ${m.from || '?'}` +
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
    `Halo! 👋 Aku *Emailnator Bot*.\n\n` +
      `Aku bisa bantu kamu bikin *email sementara* dan cek *inbox* langsung dari Telegram.\n\n` +
      `📋 *Perintah:*\n` +
      `  /new — Buat email baru\n` +
      `  /inbox — Cek inbox email kamu\n` +
      `  /read_\\<id\\> — Baca detail isi pesan\n\n` +
      `Coba /new dulu yuk! 🚀`,
    { parse_mode: 'Markdown' }
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
      `✅ *Email berhasil dibuat!*\n\n📧 \`${result.email}\`\n\nGunakan /inbox untuk cek pesan masuk.`,
      { chat_id: chatId, message_id: status.message_id, parse_mode: 'Markdown' }
    );
  } catch (err) {
    await bot.editMessageText(config.messages.error(err.message), {
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
    await bot.editMessageText(`📧 *${email}*\n\n${formatInbox(chatId, inbox)}`, {
      chat_id: chatId,
      message_id: status.message_id,
      parse_mode: 'Markdown',
    });
  } catch (err) {
    await bot.editMessageText(config.messages.error(err.message), {
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
      `📩 *Pesan*\n` +
        `ID: \`${message.id}\`\n` +
        `Dari: ${message.from}\n` +
        `Subjek: ${message.subject}\n` +
        `Waktu: ${message.time || '?'}\n\n${content}`,
      { chat_id: chatId, message_id: status.message_id, parse_mode: 'Markdown' }
    );
  } catch (err) {
    await bot.editMessageText(config.messages.error(err.message), {
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
console.log(`   Mode: polling`);

module.exports = bot;
