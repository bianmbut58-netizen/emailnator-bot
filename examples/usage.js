/**
 * Contoh pemakaian Emailnator tanpa bot Telegram
 *
 * Jalankan:
 *   node examples/usage.js
 */

const Emailnator = require('../src/emailnator');

(async () => {
  console.log('📧 Emailnator Usage Example\n');

  // 1. Buat instance
  const e = new Emailnator();

  // 2. Generate email
  console.log('⏳ Membuat email...');
  const { email } = await e.create();
  console.log(`✅ Email: ${email}\n`);

  // 3. Cek inbox
  console.log('⏳ Cek inbox...');
  const inbox = await e.getInbox(email);
  console.log(`📬 Total pesan: ${inbox.totalEmails}\n`);

  if (inbox.totalEmails > 0) {
    // 4. Baca pesan pertama
    const first = inbox.emails[0];
    console.log(`📩 Pesan pertama:`);
    console.log(`   ID: ${first.id}`);
    console.log(`   Dari: ${first.from}`);
    console.log(`   Subjek: ${first.subject}`);

    // 5. Ambil detail konten
    const detail = await e.getMessage(email, first.id);
    console.log(`   Isi: ${detail.text.slice(0, 200)}...`);
  } else {
    console.log('📭 Belum ada email. Coba kirim email ke alamat di atas, lalu jalankan ulang.');
  }
})();
