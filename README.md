# 📧 Emailnator Bot — Telegram

**Bot Telegram untuk generate email sementara dan cek inbox langsung dari Telegram.**

Dibangun di atas [Emailnator](https://www.emailnator.com) dengan Node.js.

---

## 📁 Struktur Project

```
emailnator-bot/
├── bot.js                 # Entry point — bot Telegram
├── package.json           # Dependencies & scripts
├── .gitignore             # Ignore rules
├── README.md              # Dokumentasi (ini)
├── src/
│   ├── config.js          # 🔧 Konfigurasi — isi token bot di sini!
│   └── emailnator.js      # Core class Emailnator
└── examples/
    └── usage.js           # Contoh pemakaian tanpa bot
```

---

## 🚀 Cara Install & Jalankan

### 1. Clone project

```bash
git clone https://github.com/bianmbut58-netizen/emailnator-bot.git
cd emailnator-bot
```

### 2. Install dependencies

```bash
npm install
```

### 3. Isi token bot

Buka `src/config.js`, cari baris `botToken: ''`, isi dengan token dari [@BotFather](https://t.me/BotFather):

```js
botToken: '1234567890:ABCdefGHIjklmNOPqrStuVWXyz',
```

### 4. Jalankan 🚀

```bash
npm start
```

---

## 🤖 Perintah Bot

| Perintah          | Deskripsi                          |
| ----------------- | ---------------------------------- |
| `/start`          | Lihat menu bantuan                 |
| `/new`            | Buat email baru                    |
| `/inbox`          | Cek inbox email kamu               |
| `/read_<id>`      | Baca detail isi pesan tertentu     |

### Alur pemakaian:

1. Ketik `/new` → bot akan generate email baru (contoh: `user123@gmail.com`)
2. Kirim `/inbox` kapan saja untuk cek pesan masuk
3. Kalau ada pesan, klik `/read_abc123` untuk baca isinya

---

## 🔧 Advanced Usage

### Tanpa bot (hanya library Emailnator)

```js
const Emailnator = require('./src/emailnator');

(async () => {
  const e = new Emailnator();
  const { email } = await e.create();
  console.log('Email:', email);

  const inbox = await e.getInbox(email);
  console.log('Pesan:', inbox.totalEmails);
})();
```

Jalankan: `npm test` atau `node examples/usage.js`

---

## ⚙️ Requirements

- Node.js >= 18
- NPM

---

## 📄 Lisensi

MIT — bebas pakai, bebas modifikasi.
