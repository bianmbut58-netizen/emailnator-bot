/**
 * Emailnator Bot — Configuration
 *
 * 📌 Isi langsung token bot Telegram kamu di bawah ini.
 * Jangan commit ke GitHub kalo token-nya asli! Simpan untuk local aja.
 */

const path = require('path');

const config = {
  // Token bot Telegram — dapat dari @BotFather
  // Isi langsung di sini, atau set env var TELEGRAM_BOT_TOKEN (dipakai untuk deploy di Railway)
  botToken: process.env.TELEGRAM_BOT_TOKEN || '8773654941:AAFd0whE4XitRwgE6iRPQDtZRZKU1LYx52g',

  // 💾 Penyimpanan persisten (SQLite) — daftar email tidak hilang saat restart
  //   - Railway:  set DATA_DIR=/data (volume) → DB disimpan di volume
  //   - Lokal:    default ./data/ di folder project
  storage: {
    dir: process.env.DATA_DIR || path.join(__dirname, '..', 'data'),
    file: 'emailnator.db',
  },

  // Opsi polling Telegram (optional)
  polling: {
    interval: 300,
    autoStart: true,
    params: {
      timeout: 30,
    },
  },

  // Opsi HTTP client Emailnator
  emailnator: {
    baseURL: 'https://www.emailnator.com',
    timeout: 30000,
    userAgent:
      'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36',
  },

  // Format pesan
  messages: {
    noEmail: 'Kamu belum punya email! Ketik /new buat bikin dulu ya 😊',
    emptyInbox: '📭 Inbox kosong, belum ada email masuk.',
    creating: '⏳ Lagi bikin email baru...',
    checking: (email) => `⏳ Lagi cek inbox ${email}...`,
    reading: '⏳ Lagi baca pesan...',
    error: (msg) => `❌ Gagal: ${msg}`,
    maxContentLength: 3500,
  },
};

module.exports = config;
