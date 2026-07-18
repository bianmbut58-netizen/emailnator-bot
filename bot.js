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

/**
 * Build inline keyboard rows for inbox: one button per email + refresh row.
 */
function buildInboxKeyboard(inbox) {
  const rows = [];

  inbox.emails.forEach((m, i) => {
    const label = m.subject
      ? `${i + 1}. ${m.subject.slice(0, 40)}`
      : `${i + 1}. (no subject)`;
    rows.push([
      { text: `📖 ${label}`, callback_data: `read_${m.id}` },
    ]);
  });

  // Action row
  const actionRow = [
    { text: '🔄 Refresh', callback_data: 'refresh_inbox' },
    { text: '📧 New Email', callback_data: 'new_email' },
  ];
  rows.push(actionRow);

  return rows;
}

// ===================== COMMANDS =====================

bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  const keyboard = [
    [{ text: '📧 Buat Email Baru', callback_data: 'new_email' }],
  ];
  await bot.sendMessage(
    chatId,
    `<b>Halo! 👋 Aku Emailnator Bot.</b>\n\n` +
      `Aku bisa bantu kamu bikin <b>email sementara</b> dan cek <b>inbox</b> langsung dari Telegram.\n\n` +
      `<b>📋 Perintah:</b>\n` +
      `  /new — Buat email baru\n` +
      `  /inbox — Cek inbox email kamu\n\n` +
      `Atau klik tombol di bawah! 🚀`,
    { parse_mode: 'HTML', reply_markup: { inline_keyboard: keyboard } }
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
      {
        chat_id: chatId,
        message_id: status.message_id,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📬 Cek Inbox', callback_data: 'refresh_inbox' }],
            [{ text: '📧 Buat Lagi', callback_data: 'new_email' }],
          ],
        },
      }
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
  if (!email) {
    return bot.sendMessage(chatId, config.messages.noEmail, {
      reply_markup: {
        inline_keyboard: [
          [{ text: '📧 Buat Email', callback_data: 'new_email' }],
        ],
      },
    });
  }

  const status = await bot.sendMessage(chatId, config.messages.checking(email));
  try {
    const e = new Emailnator();
    const inbox = await e.getInbox(email);

    if (inbox.totalEmails === 0) {
      await bot.editMessageText(
        `📧 <code>${email}</code>\n\n📭 Inbox kosong, belum ada email masuk.`,
        {
          chat_id: chatId,
          message_id: status.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔄 Refresh', callback_data: 'refresh_inbox' }],
              [{ text: '📧 Buat Email Baru', callback_data: 'new_email' }],
            ],
          },
        }
      );
    } else {
      const msgText = `📧 <code>${email}</code>\n\n<b>📬 ${inbox.totalEmails} pesan</b>`;
      await bot.editMessageText(msgText, {
        chat_id: chatId,
        message_id: status.message_id,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: buildInboxKeyboard(inbox),
        },
      });
    }
  } catch (err) {
    await bot.editMessageText(`❌ Gagal cek inbox: ${err.message}`, {
      chat_id: chatId,
      message_id: status.message_id,
    });
  }
});

// ===================== CALLBACK QUERY =====================

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const msgId = query.message.message_id;
  const data = query.data;

  // Always answer callback to remove loading state
  await bot.answerCallbackQuery(query.id);

  // 📖 Read message
  if (data.startsWith('read_')) {
    const messageId = data.slice(5);
    const email = getEmail(chatId);
    if (!email) {
      await bot.sendMessage(chatId, config.messages.noEmail);
      return;
    }

    const status = await bot.sendMessage(chatId, config.messages.reading);
    try {
      const e = new Emailnator();
      const message = await e.getMessage(email, messageId);
      const content = truncate(message.text, config.messages.maxContentLength);
      await bot.editMessageText(
        `<b>📩 Pesan</b>\n` +
          `Dari: ${escMD(message.from)}\n` +
          `Subjek: ${escMD(message.subject)}\n` +
          `Waktu: ${escMD(message.time || '?')}\n\n${content}`,
        {
          chat_id: chatId,
          message_id: status.message_id,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '⬅️ Kembali ke Inbox', callback_data: 'refresh_inbox' }],
            ],
          },
        }
      );
    } catch (err) {
      await bot.editMessageText(`❌ Gagal baca pesan: ${err.message}`, {
        chat_id: chatId,
        message_id: status.message_id,
      });
    }
    return;
  }

  // 🔄 Refresh inbox
  if (data === 'refresh_inbox') {
    const email = getEmail(chatId);
    if (!email) {
      await bot.editMessageText(config.messages.noEmail, {
        chat_id: chatId,
        message_id: msgId,
        reply_markup: {
          inline_keyboard: [
            [{ text: '📧 Buat Email', callback_data: 'new_email' }],
          ],
        },
      });
      return;
    }

    await bot.editMessageText(`⏳ Lagi cek inbox ${email}...`, {
      chat_id: chatId,
      message_id: msgId,
    });

    try {
      const e = new Emailnator();
      const inbox = await e.getInbox(email);

      if (inbox.totalEmails === 0) {
        await bot.editMessageText(
          `📧 <code>${email}</code>\n\n📭 Inbox kosong, belum ada email masuk.`,
          {
            chat_id: chatId,
            message_id: msgId,
            parse_mode: 'HTML',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔄 Refresh', callback_data: 'refresh_inbox' }],
                [{ text: '📧 Buat Email Baru', callback_data: 'new_email' }],
              ],
            },
          }
        );
      } else {
        const msgText = `📧 <code>${email}</code>\n\n<b>📬 ${inbox.totalEmails} pesan</b>`;
        await bot.editMessageText(msgText, {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: buildInboxKeyboard(inbox),
          },
        });
      }
    } catch (err) {
      await bot.editMessageText(`❌ Gagal refresh: ${err.message}`, {
        chat_id: chatId,
        message_id: msgId,
      });
    }
    return;
  }

  // 📧 New email
  if (data === 'new_email') {
    await bot.editMessageText('⏳ Lagi bikin email baru...', {
      chat_id: chatId,
      message_id: msgId,
    });

    try {
      const e = new Emailnator();
      const result = await e.create();
      setEmail(chatId, result.email);
      await bot.editMessageText(
        `✅ <b>Email berhasil dibuat!</b>\n\n📧 <code>${result.email}</code>`,
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📬 Cek Inbox', callback_data: 'refresh_inbox' }],
              [{ text: '📧 Buat Lagi', callback_data: 'new_email' }],
            ],
          },
        }
      );
    } catch (err) {
      await bot.editMessageText(`❌ Gagal: ${err.message}`, {
        chat_id: chatId,
        message_id: msgId,
      });
    }
    return;
  }
});

// ===================== START =====================

bot.on('polling_error', (err) => {
  console.error('⚠️ Polling error:', err.message);
});

console.log('🤖 Emailnator Bot is running...');
console.log('   Mode: polling');

module.exports = bot;
