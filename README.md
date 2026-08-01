<div align="center">

# 📧 Emailnator Bot — Telegram

**Bot Telegram untuk generate email sementara (disposable email) & cek inbox langsung dari Telegram.**

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org)
[![Python](https://img.shields.io/badge/Python-3-3776AB?logo=python&logoColor=white)](https://python.org)
[![License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Dibangun di atas [Emailnator](https://www.emailnator.com) — **Node.js** untuk bot Telegram, **Python `cloudscraper`** untuk bypass Cloudflare.

</div>

---

## ✨ Fitur

| Fitur | Deskripsi |
| ----- | --------- |
| 📧 **Generate email instan** | Buat alamat Gmail sementara sekali tap |
| 📬 **Cek inbox real-time** | Lihat daftar pesan masuk + jumlah pesan |
| 📖 **Baca isi pesan** | Detail pesan: **Dari**, **Subjek**, **Waktu**, dan konten lengkap (di-extract otomatis dari HTML) |
| 🔄 **Refresh inbox** | Tombol refresh tanpa mengetik ulang perintah |
| 📋 **Multi-email** | Simpan banyak email & ganti-ganti kapan saja |
| 🔘 **Kontrol via tombol** | Semua aksi pakai inline keyboard — tanpa hafal command |
| 🧠 **Bypass Cloudflare** | Python `cloudscraper` menangani proteksi situs |
| 🚀 **Siap deploy** | Dockerfile + railway.toml untuk auto-build di Railway |

---

## ⚙️ Requirements

- **Node.js ≥ 18** (uji coba di v22)
- **Python 3** + `pip`
- Akses internet ke `emailnator.com` (bot butuh koneksi ke situs)

> ⚠️ **Penting:** Python & `cloudscraper` **wajib ada** — `src/emailnator.js` memanggil `src/emailnator.py` via `child_process` untuk semua operasi email. Tanpa Python, bot akan error.

---

## 🚀 Cara Install & Jalankan (Lokal)

### 1. Clone project

```bash
git clone https://github.com/bianmbut58-netizen/emailnator-bot.git
cd emailnator-bot
```

### 2. Install dependencies

```bash
# Node dependencies (cheerio, node-telegram-bot-api)
npm install

# Python dependencies (cloudscraper)
pip install -r requirements.txt
```

### 3. Isi token bot

Dapatkan token dari [@BotFather](https://t.me/BotFather) → `/newbot`. Lalu set sebagai **environment variable** (cara paling aman):

```bash
export TELEGRAM_BOT_TOKEN="1234567890:ABCdefGHIjklmNOPqrStuVWXyz"
npm start
```

**Atau** isi langsung di `src/config.js` (untuk pengembangan lokal saja):

```js
botToken: '1234567890:ABCdefGHIjklmNOPqrStuVWXyz',
```

> 🔒 `process.env.TELEGRAM_BOT_TOKEN` selalu diprioritaskan. Kalau env var terisi, token di `config.js` diabaikan.

### 4. Jalankan 🎉

```bash
npm start
# atau
npm run dev
```

Kalau sukses, log muncul: `🤖 Emailnator Bot is running...` — langsung coba kirim `/start` ke bot kamu di Telegram.

---

## 🤖 Penggunaan Bot

### Perintah (commands)

| Perintah  | Deskripsi                              |
| --------- | -------------------------------------- |
| `/start`  | Lihat menu bantuan & tombol cepat      |
| `/new`    | Buat email baru (otomatis jadi email aktif) |
| `/inbox`  | Cek inbox email yang sedang aktif      |
| `/list`   | Lihat semua email tersimpan & ganti email |

### Tombol (inline keyboard)

| Tombol               | Fungsi                                  |
| -------------------- | --------------------------------------- |
| 📖 `1. Subjek...`    | Baca detail pesan tertentu              |
| 🔄 Refresh           | Muat ulang daftar inbox                 |
| 📧 New / Buat Baru   | Generate email baru                     |
| 📋 Ganti Email       | Pilih email lain dari daftar tersimpan  |
| ✅ / 📧 email        | Ganti ke email tersebut                 |
| ⬅️ Kembali           | Kembali ke tampilan inbox               |

### Alur pemakaian

1. Kirim `/start` → tap **📧 Buat Email Baru** (atau ketik `/new`)
2. Bot generate email, contoh: `user123@gmail.com` — alamat ini sekarang **aktif**
3. Pakai email itu di mana pun. Kirim `/inbox` atau tap **📬 Cek Inbox** untuk lihat pesan masuk
4. Ada pesan? Tap nomornya untuk baca **Dari / Subjek / Waktu / Isi**
5. Mau ganti alamat? `/list` atau **📋 Ganti Email** → tap email yang diinginkan
6. Email lama **tetap tersimpan** dan bisa dicek lagi kapan saja

---

## 🧩 Pakai sebagai Library (tanpa bot)

Bot-nya modular — kamu bisa pakai `Emailnator` class langsung di script Node.js sendiri.

```js
const Emailnator = require('./src/emailnator');

(async () => {
  const e = new Emailnator();

  // 1. Generate email baru
  const { email } = await e.create();
  console.log('Email:', email);

  // 2. Cek inbox
  const inbox = await e.getInbox(email);
  console.log('Total pesan:', inbox.totalEmails);

  // 3. Baca detail pesan pertama
  if (inbox.totalEmails > 0) {
    const first = inbox.emails[0];
    const detail = await e.getMessage(email, first.id);
    console.log('Dari:', detail.from);
    console.log('Subjek:', detail.subject);
    console.log('Isi:', detail.text);
  }
})();
```

Jalankan langsung: `npm test` atau `node examples/usage.js`

### API Reference

#### `new Emailnator()`
Membuat instance client.

#### `await e.create()` → `{ email: string }`
Generate email sementara baru. Melempar `Error` kalau gagal.

#### `await e.getInbox(email)` → `{ totalEmails: number, emails: Message[] }`
Ambil daftar pesan. Setiap item sudah berupa detail lengkap (`getMessage` dipanggil otomatis per pesan).

#### `await e.getMessage(email, messageID)` → `Message`
```js
{
  id: string,      // messageID
  from: string,    // pengirim (di-extract dari HTML/JSON)
  subject: string, // subjek
  text: string,    // isi pesan
  time: string,    // waktu kirim
}
```
Metadata (`from`, `subject`, `time`) di-extract dengan fallback berlapis: selector DOM (`#subject-header`, `mailto:`, dll) → meta tag → header email mentah → heuristik. Kalau tidak ketemu: `?` / `(no subject)`.

---

## 📁 Struktur Project

```
emailnator-bot/
├── bot.js                 # 🚀 Entry point — semua logika bot Telegram
├── package.json           # Dependencies & scripts
├── package-lock.json      # Lockfile (untuk build reproducible)
├── requirements.txt       # Dep Python: cloudscraper
├── Dockerfile             # 🐳 Image build (Node + Python)
├── railway.toml           # 🚂 Config deploy Railway (auto-build)
├── .dockerignore          # File yang dikecualikan saat Docker build
├── .gitignore             # Ignore rules (node_modules, .env, dll)
├── README.md              # Dokumentasi (ini)
├── src/
│   ├── config.js          # 🔧 Konfigurasi (token, polling, pesan)
│   ├── emailnator.js      # Core class Emailnator (create/inbox/read)
│   └── emailnator.py      # 🐍 Bridge Python — bypass Cloudflare via cloudscraper
└── examples/
    └── usage.js           # Contoh pemakaian tanpa bot (npm test)
```

---

## 🚂 Deploy ke Railway (Auto-Build)

Project ini sudah dilengkapi **`Dockerfile` + `railway.toml`**, jadi Railway langsung mengenali dan membangunnya otomatis.

### Langkah:

1. **Push** repo ini ke GitHub
2. Buka [Railway](https://railway.app) → **New Project → Deploy from GitHub repo** → pilih repo ini
3. Railway otomatis membaca `railway.toml` dan build lewat `Dockerfile` (Node 20 + Python 3 + cloudscraper)
4. Di tab **Variables**, tambahkan:
   ```
   TELEGRAM_BOT_TOKEN = <token dari @BotFather>
   ```
5. **Deploy** — bot langsung online. Log akan menunjukkan `🤖 Emailnator Bot is running...`

### Cara kerja config

- **`Dockerfile`** — image `node:20-slim`, install `python3`/`python3-pip`, lalu `npm ci` + `pip install -r requirements.txt`. Perintah: `node bot.js`
- **`railway.toml`** — `builder = "DOCKERFILE"`, `startCommand = "node bot.js"`, restart otomatis `ON_FAILURE` (max 10×), tanpa HTTP healthcheck (bot tidak punya web server)
- **Token TIDAK dideklarasikan di `railway.toml`** — karena variabel di toml *menimpa* variabel dashboard. Token harus di-set di tab Variables Railway.

> 💡 Bot ini pakai **long-polling** (bukan webhook), jadi tidak perlu domain/port publik.

---

## 🩺 Troubleshooting

| Gejala | Penyebab | Solusi |
| ------ | -------- | ------ |
| `ModuleNotFoundError: No module named 'cloudscraper'` | Python dep belum diinstall | `pip install -r requirements.txt` |
| `❌ Gagal baca pesan: Unexpected token '<', "<div dir=..." is not valid JSON` | **Bug lama** — sudah diperbaiki. Pastikan versi `src/emailnator.js` terbaru (output HTML sekarang di-parse dengan cheerio, bukan JSON) | `git pull` + restart bot |
| `Create failed: 403` / `Inbox failed: 403` | Cloudflare memblokir / pola request berubah | Update `cloudscraper`: `pip install -U cloudscraper` |
| `Read failed: 500` | messageID sudah kedaluwarsa / tidak valid | Kembali ke inbox & refresh, lalu tap ulang pesan |
| Bot tidak menjawab, log `ETELEGRAM 409 Conflict` | Bot jalan di **2 proses sekaligus** (polling dobel) | Hentikan proses lama, jalankan hanya satu instance |
| `ETELEGRAM 401 Unauthorized` | Token salah / sudah di-revoke | Ganti token di @BotFather & update `TELEGRAM_BOT_TOKEN` / `config.js` |
| `❌ Token bot belum diisi!` lalu exit | `botToken` kosong di config & env var tidak ada | Set `TELEGRAM_BOT_TOKEN` atau isi `src/config.js` |
| Daftar email hilang setelah restart | Data tersimpan **di memory** (`Map`), bukan database | Fitur desain — buat email lagi dengan `/new`. (Upgrade ke database dimungkinkan) |
| `Gagal cek inbox: ...` | Jaringan ke emailnator.com bermasalah | Cek koneksi & coba lagi |
| `Unexpected response from Emailnator (no email returned)` | Respons situs berubah / bukan JSON | Update bot ke versi terbaru; laporkan issue |

---

## 🔐 Catatan Keamanan

- **Jangan commit token asli ke GitHub.** Token di `config.js` yang sudah pernah ter-push sebaiknya **di-revoke di [@BotFather](https://t.me/BotFather)** dan diganti.
- Cara terbaik: set `TELEGRAM_BOT_TOKEN` sebagai **environment variable** (Railway Variables / export di shell) dan biarkan `config.js` apa adanya.
- Bot ini memakai layanan pihak ketiga (emailnator.com) — alamat email sementara **tidak cocok** untuk data sensitif.

---

## 🧪 Testing

```bash
npm test
```

Menjalankan `node examples/usage.js` — generate email sungguhan, cek inbox, lalu baca pesan pertama (kalau ada). Butuh koneksi internet & Python terpasang.

---

## 📄 Lisensi

[MIT](LICENSE) — bebas pakai, bebas modifikasi. Dibuat untuk edukasi.

---

<div align="center">

**💡 Tips:** Kalau botnya dipakai banyak orang, pertimbangkan memindahkan penyimpanan email dari memory ke database (misal SQLite/Postgres) supaya tidak hilang saat restart.

</div>
