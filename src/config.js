/**
 * Emailnator Bot — Configuration
 *
 * Ubah nilai di bawah sesuai dengan kebutuhan kamu.
 * Jangan commit token asli ke git! Gunakan .env atau environment variable.
 */

const config = {
  // Token bot Telegram — dapat dari @BotFather
  botToken: process.env.BOT_TOKEN || '',

  // Opsi polling Telegram (optional)
  polling: {
    interval: 300,      // ms antara polling request
    autoStart: true,
    params: {
      timeout: 30,       // long-polling timeout (detik)
    },
  },

  // Opsi HTTP client Emailnator
  emailnator: {
    baseURL: 'https://www.emailnator.com',
    timeout: 30000,      // 30 detik timeout request
    userAgent: 'Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 Chrome/140.0.0.0 Mobile Safari/537.36',
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
