// Keys for the legal pages, footer, cookie notice, sign-up consent, About page
// and self-service account deletion. Merged into the main dictionaries in
// translations.ts; `idLegal` is typed against `enLegal`.

export const enLegal = {
  // Footer / links
  "legal.privacy": "Privacy",
  "legal.terms": "Terms",
  "legal.refunds": "Refunds",
  "legal.cookies": "Cookies",
  "legal.about": "About & contact",
  "legal.rights": "© {year} A Team · Universitas Terbuka",
  "legal.updated": "Last updated {date}",
  "legal.onThisPage": "Other policies",
  "legal.back": "Back to Komunitas",
  "legal.questions": "Questions? Email",

  // Cookie notice
  "cookie.text": "Komunitas only uses essential cookies and browser storage to keep you signed in and remember your language, theme and area. No tracking or ads.",
  "cookie.more": "Cookie policy",
  "cookie.ok": "Got it",

  // Sign-up consent
  "consent.agreePrefix": "I agree to the",
  "consent.terms": "Terms of Service",
  "consent.and": "and",
  "consent.privacy": "Privacy Policy",
  "consent.agreeSuffix": ", including how my data is used.",
  "consent.required": "Please agree to the Terms and Privacy Policy to create an account.",

  // About
  "about.title": "About Komunitas",
  "about.intro": "Komunitas helps people find, create and join local social activities, from runs and book clubs to badminton and community gatherings.",
  "about.whoTitle": "Who runs it",
  "about.who": "Komunitas is a non-commercial student capstone project by A Team at Universitas Terbuka, Indonesia. It's free to use and doesn't take payments.",
  "about.contactTitle": "Contact",
  "about.contactBody": "For questions, privacy requests or legal notices, email us. In the app you can also use Help & Support.",
  "about.operator": "Operator",
  "about.email": "Email",
  "about.website": "Website",
  "about.country": "Country",
  "about.creditsTitle": "Credits & licenses",
  "about.creditsIntro": "Komunitas is built with open-source software and open data:",

  // Delete account
  "deleteAccount.title": "Delete account",
  "deleteAccount.desc": "Permanently delete your account and personal data. This can't be undone.",
  "deleteAccount.open": "Delete my account",
  "deleteAccount.listTitle": "What happens:",
  "deleteAccount.item1": "Your profile, hobbies, social links, PIN, notifications and uploaded banners are deleted.",
  "deleteAccount.item2": "Your upcoming activities are cancelled, and you leave activities you joined.",
  "deleteAccount.item3": "Comments and messages you sent stay, shown as from a deleted user.",
  "deleteAccount.item4": "Your login is removed and you're signed out.",
  "deleteAccount.confirmLabel": "Type {word} to confirm",
  "deleteAccount.word": "DELETE",
  "deleteAccount.confirm": "Delete permanently",
  "deleteAccount.deleting": "Deleting…",
  "deleteAccount.cancel": "Cancel",
  "deleteAccount.error": "Couldn't delete your account. Please try again, or email us.",
  "deleteAccount.lastSuperAdmin": "You're the only super admin. Make someone else super admin before deleting your account.",
  "deleteAccount.unavailable": "Account deletion isn't available right now. Please email us to delete your account.",
  "deleteAccount.done": "Your account has been deleted.",

  // Email footer (security/account emails are transactional: no unsubscribe)
  "email.footer": "You're getting this because it's an important security notice about your Komunitas account, so it can't be turned off. We never send marketing emails. Privacy policy: {url}",

  // Accessibility
  "a11y.skip": "Skip to content",
};

export const idLegal: Record<keyof typeof enLegal, string> = {
  "legal.privacy": "Privasi",
  "legal.terms": "Syarat",
  "legal.refunds": "Pengembalian dana",
  "legal.cookies": "Cookie",
  "legal.about": "Tentang & kontak",
  "legal.rights": "© {year} A Team · Universitas Terbuka",
  "legal.updated": "Terakhir diperbarui {date}",
  "legal.onThisPage": "Kebijakan lainnya",
  "legal.back": "Kembali ke Komunitas",
  "legal.questions": "Ada pertanyaan? Kirim email ke",

  "cookie.text": "Komunitas hanya memakai cookie dan penyimpanan browser yang penting agar kamu tetap masuk dan untuk mengingat bahasa, tema, dan wilayahmu. Tanpa pelacak atau iklan.",
  "cookie.more": "Kebijakan cookie",
  "cookie.ok": "Mengerti",

  "consent.agreePrefix": "Saya menyetujui",
  "consent.terms": "Syarat Layanan",
  "consent.and": "dan",
  "consent.privacy": "Kebijakan Privasi",
  "consent.agreeSuffix": ", termasuk cara data saya digunakan.",
  "consent.required": "Setujui Syarat Layanan dan Kebijakan Privasi untuk membuat akun.",

  "about.title": "Tentang Komunitas",
  "about.intro": "Komunitas membantu orang menemukan, membuat, dan mengikuti aktivitas sosial di sekitarnya, dari lari bareng dan klub buku sampai bulu tangkis dan kumpul komunitas.",
  "about.whoTitle": "Siapa yang menjalankan",
  "about.who": "Komunitas adalah proyek capstone mahasiswa yang nonkomersial, dibuat oleh A Team di Universitas Terbuka, Indonesia. Gratis dipakai dan tidak menerima pembayaran.",
  "about.contactTitle": "Kontak",
  "about.contactBody": "Untuk pertanyaan, permintaan terkait privasi, atau pemberitahuan hukum, kirim email kepada kami. Di aplikasi, kamu juga bisa memakai menu Bantuan.",
  "about.operator": "Pengelola",
  "about.email": "Email",
  "about.website": "Situs",
  "about.country": "Negara",
  "about.creditsTitle": "Kredit & lisensi",
  "about.creditsIntro": "Komunitas dibangun dengan perangkat lunak dan data terbuka:",

  "deleteAccount.title": "Hapus akun",
  "deleteAccount.desc": "Hapus akun dan data pribadimu secara permanen. Tindakan ini tidak bisa dibatalkan.",
  "deleteAccount.open": "Hapus akun saya",
  "deleteAccount.listTitle": "Yang akan terjadi:",
  "deleteAccount.item1": "Profil, hobi, tautan sosial, PIN, notifikasi, dan banner yang kamu unggah dihapus.",
  "deleteAccount.item2": "Aktivitasmu yang akan datang dibatalkan, dan kamu keluar dari aktivitas yang kamu ikuti.",
  "deleteAccount.item3": "Komentar dan pesan yang pernah kamu kirim tetap ada, ditampilkan sebagai dari pengguna yang dihapus.",
  "deleteAccount.item4": "Login-mu dihapus dan kamu otomatis keluar.",
  "deleteAccount.confirmLabel": "Ketik {word} untuk konfirmasi",
  "deleteAccount.word": "HAPUS",
  "deleteAccount.confirm": "Hapus permanen",
  "deleteAccount.deleting": "Menghapus…",
  "deleteAccount.cancel": "Batal",
  "deleteAccount.error": "Gagal menghapus akun. Coba lagi, atau kirim email kepada kami.",
  "deleteAccount.lastSuperAdmin": "Kamu satu-satunya super admin. Jadikan orang lain super admin sebelum menghapus akunmu.",
  "deleteAccount.unavailable": "Penghapusan akun sedang tidak tersedia. Kirim email kepada kami untuk menghapus akunmu.",
  "deleteAccount.done": "Akunmu sudah dihapus.",

  "email.footer": "Kamu menerima email ini karena berisi pemberitahuan keamanan penting tentang akun Komunitas-mu, jadi tidak bisa dimatikan. Kami tidak pernah mengirim email promosi. Kebijakan privasi: {url}",

  "a11y.skip": "Langsung ke konten",
};
