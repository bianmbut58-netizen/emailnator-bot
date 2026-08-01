const TelegramBot = require('node-telegram-bot-api');
const Emailnator = require('./src/emailnator');
const config = require('./src/config');
const store = require('./src/storage');

// ===================== INIT =====================

if (!config.botToken) {
  console.error('❌ Token bot belum diisi!');
  console.error('   Buka src/config.js dan isi field botToken dengan token dari @BotFather');
  process.exit(1);
}

const bot = new TelegramBot(config.botToken, { polling: config.polling });

// Kode terakhir yang terdeteksi per chat (dipakai tombol 📋 Copy Kode)
const lastCodeByChat = new Map();

/**
 * User storage (persisten, SQLite — lihat src/storage.js):
 *   { active: string, list: string[] }
 *
 *   - active: email yang sedang dipakai sekarang
 *   - list:   semua email yang pernah dibuat (termasuk active)
 *
 * Data disimpan di database, jadi tidak hilang saat bot restart.
 */

// ===================== HELPERS =====================

function getUser(chatId) {
  return store.getUser(chatId);
}

function getActiveEmail(chatId) {
  return getUser(chatId).active;
}

function setActiveEmail(chatId, email) {
  store.setActive(chatId, email);
}

function pushNewEmail(chatId, email) {
  const u = getUser(chatId);
  if (u.active) {
    // simpan email lama ke daftar kalau belum ada
    store.addEmail(chatId, u.active);
  }
  store.setActive(chatId, email);
}

function escHTML(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncate(text, maxLen) {
  if (!text || text.length <= maxLen) return escHTML(text || '<i>(kosong)</i>');
  return escHTML(text.slice(0, maxLen)) + '\n\n...<i>(dipotong, terlalu panjang)</i>';
}

/**
 * Format waktu agar ringkas & konsisten.
 * - Date valid → "01 Agu 2026, 14.05" (lokal)
 * - Header mentah seperti "Fri, 1 Aug 2026 10:32:05 +0000" → ambil jam:menit
 * - Kalau tidak bisa di-parse → potong aslinya
 */
function formatTime(t) {
  if (!t) return '';
  const s = String(t).trim();
  const d = new Date(s);
  if (!isNaN(d.getTime())) {
    const bulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
    const dd = String(d.getDate()).padStart(2, '0');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${dd} ${bulan[d.getMonth()]}, ${hh}:${mm}`;
  }
  const hm = s.match(/(\d{1,2}:\d{2}(?::\d{2})?)/);
  if (hm) return hm[1];
  return s.slice(0, 16);
}

/**
 * Deteksi kode (OTP / verifikasi) di dalam isi pesan.
 * - Prioritas 1: deretan 4-8 angka yang berdiri sendiri (mis. "123456")
 * - Prioritas 2: token alfanumerik 5-12 karakter yang wajib berisi angka + huruf
 * Mengembalikan kode (string) atau null kalau tidak ada.
 */
function detectCode(text) {
  if (!text) return null;
  const s = String(text);
  const otp = s.match(/(?<![\dA-Za-z])(\d{4,8})(?![\dA-Za-z])/);
  if (otp) return otp[1];
  for (const tok of s.match(/[A-Za-z0-9]{5,12}/g) || []) {
    if (/\d/.test(tok) && /[A-Za-z]/.test(tok)) return tok;
  }
  return null;
}

function buildInboxKeyboard(inbox) {
  const rows = [];
  inbox.emails.forEach((m, i) => {
    const label = m.subject
      ? `${i + 1}. ${m.subject.slice(0, 40)}`
      : `${i + 1}. (no subject)`;
    const t = formatTime(m.time);
    rows.push([{ text: `📖 ${label}${t ? ` — ${t}` : ''}`, callback_data: `read_${m.id}` }]);
  });
  rows.push([
    { text: '🔄 Refresh', callback_data: 'refresh_inbox' },
    { text: '📧 New', callback_data: 'new_email' },
  ]);
  rows.push([{ text: '📋 Ganti Email', callback_data: 'show_emails' }]);
  return rows;
}

function buildEmailListKeyboard(chatId) {
  const u = getUser(chatId);
  const rows = [];
  u.list.forEach((email) => {
    const isActive = email === u.active;
    const label = isActive ? `✅ ${email}` : `📧 ${email}`;
    rows.push([{ text: label, callback_data: `switch_${email}` }]);
  });
  rows.push([
    { text: '📧 Buat Baru', callback_data: 'new_email' },
    { text: '⬅️ Kembali', callback_data: 'back_inbox' },
  ]);
  return rows;
}

// ===================== SEND INBOX =====================

async function sendInbox(chatId, msgId, email) {
  const e = new Emailnator();
  const inbox = await e.getInbox(email);

  if (inbox.totalEmails === 0) {
    const text = `📧 <code>${email}</code>\n\n📭 Inbox kosong, belum ada email masuk.`;
    if (msgId) {
      return bot.editMessageText(text, {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔄 Refresh', callback_data: 'refresh_inbox' }],
            [{ text: '📋 Ganti Email', callback_data: 'show_emails' }],
            [{ text: '📧 Buat Baru', callback_data: 'new_email' }],
          ],
        },
      });
    }
  }

  const text = `📧 <code>${email}</code>\n\n<b>📬 ${inbox.totalEmails} pesan</b>`;
  if (msgId) {
    return bot.editMessageText(text, {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buildInboxKeyboard(inbox) },
    });
  }
}

// ===================== COMMANDS =====================

bot.onText(/^\/start$/, async (msg) => {
  const chatId = msg.chat.id;
  await bot.sendMessage(
    chatId,
    `<b>Halo! 👋 Aku Emailnator Bot.</b>\n\n` +
      `Aku bisa bantu kamu bikin <b>email sementara</b> dan cek <b>inbox</b> langsung dari Telegram.\n\n` +
      `<b>📋 Perintah:</b>\n` +
      `  /new  — Buat email baru\n` +
      `  /inbox — Cek inbox email aktif\n` +
      `  /list  — Lihat & ganti email tersimpan\n\n` +
      `Atau klik tombol di bawah! 🚀`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📧 Buat Email Baru', callback_data: 'new_email' }],
        ],
      },
    }
  );
});

bot.onText(/^\/new$/, async (msg) => {
  const chatId = msg.chat.id;
  const status = await bot.sendMessage(chatId, '⏳ Lagi bikin email baru...');

  try {
    const e = new Emailnator();
    const result = await e.create();
    pushNewEmail(chatId, result.email);

    await bot.editMessageText(
      `✅ <b>Email berhasil dibuat!</b>\n\n📧 <code>${result.email}</code>\n\nEmail lama masih tersimpan, ketik /list untuk lihat semua.`,
      {
        chat_id: chatId,
        message_id: status.message_id,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📬 Cek Inbox', callback_data: 'refresh_inbox' }],
            [{ text: '📋 Semua Email', callback_data: 'show_emails' }],
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

bot.onText(/^\/list$/, async (msg) => {
  const chatId = msg.chat.id;
  const u = getUser(chatId);

  if (u.list.length === 0) {
    return bot.sendMessage(chatId, 'Belum ada email! Ketik /new buat bikin dulu ya 😊', {
      reply_markup: {
        inline_keyboard: [[{ text: '📧 Buat Email', callback_data: 'new_email' }]],
      },
    });
  }

  const lines = u.list.map((e) => (e === u.active ? `✅ ${e}` : `📧 ${e}`));
  await bot.sendMessage(
    chatId,
    `<b>📋 Semua Email Tersimpan:</b>\n\n${lines.join('\n')}\n\nTap salah satu untuk pake email itu.`,
    {
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buildEmailListKeyboard(chatId) },
    }
  );
});

bot.onText(/^\/inbox$/, async (msg) => {
  const chatId = msg.chat.id;
  const email = getActiveEmail(chatId);

  if (!email) {
    return bot.sendMessage(chatId, 'Kamu belum punya email! Ketik /new dulu ya 😊', {
      reply_markup: {
        inline_keyboard: [[{ text: '📧 Buat Email', callback_data: 'new_email' }]],
      },
    });
  }

  const status = await bot.sendMessage(chatId, `⏳ Lagi cek inbox ${email}...`);
  try {
    await sendInbox(chatId, status.message_id, email);
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

  await bot.answerCallbackQuery(query.id);

  // 📖 Read
  if (data.startsWith('read_')) {
    const messageId = data.slice(5);
    const email = getActiveEmail(chatId);
    if (!email) return bot.sendMessage(chatId, 'Belum punya email!');

    const status = await bot.sendMessage(chatId, '⏳ Lagi baca pesan...');
    try {
      const e = new Emailnator();
      const message = await e.getMessage(email, messageId);
      const code = detectCode(message.text);
      if (code) lastCodeByChat.set(chatId, code);

      const content = truncate(message.text, config.messages.maxContentLength);
      const waktu = formatTime(message.time) || message.time || '?';
      const header =
        `<b>📩 Pesan</b>\n` +
        `Dari: ${escHTML(message.from)}\n` +
        `Subjek: ${escHTML(message.subject)}\n` +
        `Waktu: ${escHTML(waktu)}\n\n`;

      const keyboard = [];
      if (code) {
        keyboard.push([
          { text: `📋 Copy Kode: ${code.slice(0, 10)}`, callback_data: 'copy_code' },
        ]);
      }
      keyboard.push([{ text: '⬅️ Kembali ke Inbox', callback_data: 'refresh_inbox' }]);

      await bot.editMessageText(
        `${header}${code ? `🔑 <b>Kode:</b> <code>${escHTML(code)}</code>\n\n` : ''}${content}`,
        {
          chat_id: chatId,
          message_id: status.message_id,
          parse_mode: 'HTML',
          reply_markup: { inline_keyboard: keyboard },
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

  // 📋 Copy kode (OTP/verifikasi)
  if (data === 'copy_code') {
    const code = lastCodeByChat.get(chatId);
    if (!code) {
      return bot.answerCallbackQuery(query.id, {
        text: 'Kode tidak ditemukan — buka ulang pesannya ya',
      });
    }
    await bot.answerCallbackQuery(query.id, { text: `Kode: ${code}` });
    await bot.sendMessage(
      chatId,
      `📋 <b>Kode:</b>\n\n<code>${escHTML(code)}</code>\n\n` +
        `👆 Tekan & tahan kode di atas, lalu pilih <b>Copy</b> untuk menyalin.`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // 🔄 Refresh
  if (data === 'refresh_inbox') {
    const email = getActiveEmail(chatId);
    if (!email) {
      return bot.editMessageText('Belum punya email!', {
        chat_id: chatId,
        message_id: msgId,
        reply_markup: {
          inline_keyboard: [[{ text: '📧 Buat Email', callback_data: 'new_email' }]],
        },
      });
    }

    await bot.editMessageText(`⏳ Refresh inbox ${email}...`, {
      chat_id: chatId,
      message_id: msgId,
    });

    try {
      await sendInbox(chatId, msgId, email);
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
      pushNewEmail(chatId, result.email);

      await bot.editMessageText(
        `✅ <b>Email berhasil dibuat!</b>\n\n📧 <code>${result.email}</code>\n\nEmail lama masih tersimpan.`,
        {
          chat_id: chatId,
          message_id: msgId,
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: [
              [{ text: '📬 Cek Inbox', callback_data: 'refresh_inbox' }],
              [{ text: '📋 Semua Email', callback_data: 'show_emails' }],
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

  // 📋 Show all emails
  if (data === 'show_emails') {
    const u = getUser(chatId);
    if (u.list.length === 0) {
      return bot.editMessageText('Belum ada email!', {
        chat_id: chatId,
        message_id: msgId,
        reply_markup: {
          inline_keyboard: [[{ text: '📧 Buat Email', callback_data: 'new_email' }]],
        },
      });
    }

    await bot.editMessageText('<b>📋 Pilih Email:</b>', {
      chat_id: chatId,
      message_id: msgId,
      parse_mode: 'HTML',
      reply_markup: { inline_keyboard: buildEmailListKeyboard(chatId) },
    });
    return;
  }

  // ⬅️ Back to inbox
  if (data === 'back_inbox') {
    const email = getActiveEmail(chatId);
    if (!email) {
      return bot.editMessageText('Belum punya email!', {
        chat_id: chatId,
        message_id: msgId,
        reply_markup: {
          inline_keyboard: [[{ text: '📧 Buat Email', callback_data: 'new_email' }]],
        },
      });
    }
    await bot.editMessageText(`⏳ Balik ke inbox...`, {
      chat_id: chatId,
      message_id: msgId,
    });
    try {
      await sendInbox(chatId, msgId, email);
    } catch (err) {
      await bot.editMessageText(`❌ Gagal: ${err.message}`, {
        chat_id: chatId,
        message_id: msgId,
      });
    }
    return;
  }

  // 🔄 Switch email
  if (data.startsWith('switch_')) {
    const targetEmail = data.slice(7);
    const u = getUser(chatId);

    if (targetEmail === u.active) {
      return bot.editMessageText('Ini udah email yang aktif sekarang.', {
        chat_id: chatId,
        message_id: msgId,
        reply_markup: {
          inline_keyboard: [[{ text: '⬅️ Kembali', callback_data: 'show_emails' }]],
        },
      });
    }

    if (!u.list.includes(targetEmail)) {
      return bot.editMessageText('Email nggak ditemukan.', {
        chat_id: chatId,
        message_id: msgId,
      });
    }

    store.setActive(chatId, targetEmail);

    await bot.editMessageText(
      `✅ <b>Berhasil ganti ke:</b>\n\n📧 <code>${targetEmail}</code>`,
      {
        chat_id: chatId,
        message_id: msgId,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📬 Cek Inbox', callback_data: 'refresh_inbox' }],
            [{ text: '📋 Semua Email', callback_data: 'show_emails' }],
          ],
        },
      }
    );
    return;
  }
});

// ===================== POLLING ERROR =====================

bot.on('polling_error', (err) => {
  console.error('⚠️ Polling error:', err.message);
});

console.log('🤖 Emailnator Bot is running...');
console.log('   Mode: polling');

module.exports = bot;
