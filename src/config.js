/**
 * Emailnator Bot — Configuration
 *
 * 📌 Isi langsung token bot Telegram kamu di bawah ini.
 * Jangan commit ke GitHub kalo token-nya asli! Simpan untuk local aja.
 */

const config = {
  // Token bot Telegram — dapat dari @BotFather
  // Isi langsung di sini: botToken: '123456:ABCdef...'
  botToken: '',

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
