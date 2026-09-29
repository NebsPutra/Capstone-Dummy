// Legal documents (privacy, terms, refunds, cookies) and the operator's
// public details. These are long-form content, so they live here rather than
// in the UI string dictionaries; `id` is typed against the same shape as `en`.
// Keep them in sync with what the app actually does (data, cookies, services).

import type { Lang } from "@/lib/i18n/translations";

export const LEGAL_UPDATED = "2026-09-29";

export const BUSINESS = {
  product: "Komunitas",
  operator: "A Team",
  institution: "Universitas Terbuka",
  country: "Indonesia",
  email: "bennedictusputra@gmail.com",
  site: "https://komunitasa.vercel.app",
};

export const LEGAL_DOCS = ["privacy", "terms", "refunds", "cookies"] as const;
export type LegalDocKey = (typeof LEGAL_DOCS)[number];

/** A paragraph, or a bullet list. */
export type Block = string | string[];
export interface Section {
  heading: string;
  body: Block[];
}
export interface LegalDoc {
  title: string;
  summary: string;
  sections: Section[];
}

const E = BUSINESS.email;

const en: Record<LegalDocKey, LegalDoc> = {
  privacy: {
    title: "Privacy Policy",
    summary:
      "What personal data Komunitas collects, why, who it's shared with, how long it's kept, and how to see, change or delete it.",
    sections: [
      {
        heading: "Who we are",
        body: [
          `Komunitas is a non-commercial student capstone project built by ${BUSINESS.operator} at ${BUSINESS.institution}, ${BUSINESS.country}. We act as the controller of the personal data described here. Contact us at ${E}.`,
          "We handle personal data in line with Indonesia's Personal Data Protection Law (UU No. 27 Tahun 2022).",
        ],
      },
      {
        heading: "What we collect",
        body: [
          [
            "Account: your email address, your password (stored only as a secure hash by our authentication provider) and your sign-in PIN (stored only as a bcrypt hash).",
            "Profile: full name, nickname, username, age, gender, WhatsApp number, your area (province, city, kecamatan, kelurahan and that area's approximate centre point), bio, profile photo, hobbies, social links and your privacy settings.",
            "Activity content: activities you create (including banner images), your participation, comments, private messages, friends and blocks.",
            "Support: complaints you file and any attachments.",
            "Security: sign-in and account events with a short device label (for example \"Chrome · Windows\"), and a salted hash of your network address used only to slow down repeated PIN guesses. We never store your raw IP address.",
          ],
          "Location: when you allow it, your device's live GPS position is used at that moment to find activities near you. It is never saved to our database. If you pick an area instead, only that area is used.",
        ],
      },
      {
        heading: "Why we use it",
        body: [
          [
            "To run your account and sign you in securely (performing our agreement with you).",
            "To show activities near you and matching your hobbies, and to let you create, join and discuss activities (performing our agreement).",
            "To keep the community safe: preventing abuse, handling reports and complaints, and keeping an audit log of admin actions (our legitimate interest and legal obligations).",
            "To send account and security emails, such as sign-in codes and alerts when your PIN or password changes (necessary for the service).",
          ],
          "We do not sell your data, show ads, or use analytics or advertising trackers.",
        ],
      },
      {
        heading: "Who can see your data",
        body: [
          "Other members see what you choose to show: your public profile according to your privacy settings, activities you create, and your comments. Your full name, WhatsApp number, age and exact area are not readable by other members. An organizer's WhatsApp number is shown only when they make it public or to approved participants.",
          "Moderators and admins can access account data when needed to handle reports, complaints and safety issues. Every admin change is recorded in an audit log.",
        ],
      },
      {
        heading: "Service providers",
        body: [
          "We use these providers to run Komunitas. They process data only to provide their service:",
          [
            "Supabase: database, sign-in, file storage and realtime messages.",
            "Vercel: hosting of the website.",
            "OpenStreetMap tile servers and Nominatim: map images and turning an area name into an approximate point. They receive your network address and the map area you view.",
            "emsifa API (GitHub Pages): lists of Indonesian regions for the area pickers.",
            "Google (Gmail SMTP): sending email.",
          ],
          "WhatsApp opens only when you tap a WhatsApp link. Some providers may process data outside Indonesia; we choose providers with appropriate security measures.",
        ],
      },
      {
        heading: "How long we keep it",
        body: [
          "We keep your data while your account is active. When you delete your account, your personal profile data, hobbies, participations, social links, sign-in PIN, notifications and uploaded banners are removed right away and your login is removed. Your upcoming activities are cancelled. Comments and messages you sent stay visible to their recipients, shown as from a deleted user. Complaint records and admin audit logs are kept as long as needed for safety and legal reasons.",
        ],
      },
      {
        heading: "Your rights",
        body: [
          "You can access and correct your profile at any time in Profile, and control who sees it in Profile → Privacy. You can delete your account and personal data yourself in Profile → Security → Delete account. You can also ask us to explain, correct, restrict or delete your data, or withdraw consent, by emailing " + E + ". We reply within 3 x 24 hours on working days, as the law requires.",
        ],
      },
      {
        heading: "Security",
        body: [
          "Access to data is enforced in the database itself with row-level security on every table. Passwords and PINs are hashed, PIN sign-in locks after repeated wrong attempts, and secret keys are kept on the server only. No system is perfectly secure; if a breach affects you, we will notify you and the authorities as the law requires.",
        ],
      },
      {
        heading: "Children",
        body: [
          "Komunitas is intended for adults. If you believe a child has given us personal data without a parent's or guardian's consent, contact us and we will delete it.",
        ],
      },
      {
        heading: "Changes",
        body: [
          "If we change this policy, we update the date at the top and, for important changes, let you know in the app.",
        ],
      },
    ],
  },
  terms: {
    title: "Terms of Service",
    summary: "The rules for using Komunitas, for participants and organizers.",
    sections: [
      {
        heading: "About these terms",
        body: [
          `These terms are an agreement between you and ${BUSINESS.operator}, who runs Komunitas as a non-commercial student project at ${BUSINESS.institution}. By creating an account you agree to them and to our Privacy Policy.`,
        ],
      },
      {
        heading: "Your account",
        body: [
          [
            "Give accurate information and keep your password and PIN private. You're responsible for activity on your account.",
            "One person, one account. Don't impersonate anyone.",
            "You can delete your account at any time in Profile → Security.",
          ],
        ],
      },
      {
        heading: "Activities and organizers",
        body: [
          "Komunitas helps people find and organize activities. We don't run the activities ourselves. Organizers are responsible for their activities: accurate details (date, place, capacity, fee), a safe setting, and any permits needed. Participants take part at their own risk and should use their own judgment, especially when meeting people for the first time.",
          "Any fee is shown on the activity before you join, and is paid directly to the organizer outside Komunitas. See the Refund Policy.",
        ],
      },
      {
        heading: "Acceptable use",
        body: [
          "Don't use Komunitas to:",
          [
            "harass, threaten, or discriminate against anyone;",
            "post illegal, hateful, sexual or violent content, spam or scams;",
            "create fake activities, or post misleading details or fake reviews;",
            "collect other members' data, or try to break or overload the service.",
          ],
          "Report anything that breaks these rules. Moderators may remove content and suspend or deactivate accounts that do.",
        ],
      },
      {
        heading: "Your content",
        body: [
          "You keep ownership of what you post. You give us permission to store and show it in Komunitas so the service works. Only upload banners and photos you have the right to use.",
        ],
      },
      {
        heading: "The service",
        body: [
          "Komunitas is a student project, provided \"as is\" and free of charge. We try to keep it available and correct, but can't guarantee it will always work, and we may change or end features. To the extent the law allows, we aren't liable for losses arising from activities organized through Komunitas or from use of the service.",
        ],
      },
      {
        heading: "Law and contact",
        body: [
          `These terms are governed by the laws of the Republic of Indonesia. Questions: ${E}.`,
        ],
      },
    ],
  },
  refunds: {
    title: "Refund Policy",
    summary: "How fees and refunds work for activities on Komunitas.",
    sections: [
      {
        heading: "Komunitas is free",
        body: [
          "Using Komunitas costs nothing. We don't charge subscriptions or service fees, and we never take payments through the app, so there are no hidden fees.",
        ],
      },
      {
        heading: "Activity fees",
        body: [
          "Some organizers set a fee for their activity, for example to cover court rental. The fee is always shown on the activity before you join (\"Free\" when there is none). You pay it directly to the organizer, outside Komunitas.",
        ],
      },
      {
        heading: "Refunds",
        body: [
          [
            "Refunds for activity fees are between you and the organizer. Ask the organizer, whose contact person and WhatsApp are shown on the activity for approved participants.",
            "If an activity is cancelled, we expect the organizer to refund any fee collected in full.",
            "If an organizer doesn't respond or you suspect a scam, report the activity through Help & Support. We can investigate and remove activities and accounts, but we can't make or reverse payments ourselves.",
          ],
        ],
      },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    summary: "The cookies and browser storage Komunitas uses. All are strictly necessary; there are no tracking or advertising cookies.",
    sections: [
      {
        heading: "Our approach",
        body: [
          "Komunitas only uses cookies and browser storage that are needed for the site to work or to remember choices you made. We don't use analytics, advertising or social media tracking cookies, so there is nothing to opt out of.",
        ],
      },
      {
        heading: "Cookies",
        body: [
          [
            "sb-…-auth-token (Supabase): keeps you signed in. Session, removed when you sign out.",
            "komunitas-lang: your language (English or Indonesian). 1 year.",
            "komunitas-theme: light, dark or system theme. 1 year.",
          ],
        ],
      },
      {
        heading: "Browser storage (localStorage)",
        body: [
          [
            "komunitas-lang: a copy of your language choice.",
            "komunitas-location: whether you use GPS or a chosen area, and that area. Your live GPS position is not stored.",
            "komunitas-wilayah-… and komunitas-geocode-v1: cached region lists and area look-ups, so pickers load faster.",
            "komunitas-cookie-notice: that you've seen the cookie notice.",
          ],
        ],
      },
      {
        heading: "Third parties",
        body: [
          "Map images come from OpenStreetMap servers, which receive your network address like any website you load, but we don't let them set tracking cookies through Komunitas.",
        ],
      },
      {
        heading: "Managing cookies",
        body: [
          "You can delete cookies and site data in your browser settings. If you block them, you won't be able to stay signed in, and the site will forget your language and theme.",
        ],
      },
    ],
  },
};

const id: Record<LegalDocKey, LegalDoc> = {
  privacy: {
    title: "Kebijakan Privasi",
    summary:
      "Data pribadi apa yang dikumpulkan Komunitas, untuk apa, dibagikan kepada siapa, berapa lama disimpan, dan cara melihat, mengubah, atau menghapusnya.",
    sections: [
      {
        heading: "Siapa kami",
        body: [
          `Komunitas adalah proyek capstone mahasiswa yang nonkomersial, dibuat oleh ${BUSINESS.operator} di ${BUSINESS.institution}, ${BUSINESS.country}. Kami bertindak sebagai pengendali data pribadi yang dijelaskan di sini. Hubungi kami di ${E}.`,
          "Kami mengelola data pribadi sesuai Undang-Undang Pelindungan Data Pribadi (UU No. 27 Tahun 2022).",
        ],
      },
      {
        heading: "Data yang kami kumpulkan",
        body: [
          [
            "Akun: alamat email, kata sandi (hanya disimpan sebagai hash aman oleh penyedia autentikasi kami), dan PIN masuk (hanya disimpan sebagai hash bcrypt).",
            "Profil: nama lengkap, nama panggilan, username, usia, jenis kelamin, nomor WhatsApp, wilayahmu (provinsi, kota, kecamatan, kelurahan, dan perkiraan titik tengah wilayah itu), bio, foto profil, hobi, tautan media sosial, dan pengaturan privasi.",
            "Konten aktivitas: aktivitas yang kamu buat (termasuk gambar banner), keikutsertaanmu, komentar, pesan pribadi, teman, dan daftar blokir.",
            "Bantuan: keluhan yang kamu kirim beserta lampirannya.",
            "Keamanan: catatan masuk dan perubahan akun dengan label perangkat singkat (misalnya \"Chrome · Windows\"), serta hash bergaram dari alamat jaringanmu yang hanya dipakai untuk memperlambat tebakan PIN berulang. Alamat IP aslimu tidak pernah disimpan.",
          ],
          "Lokasi: jika kamu mengizinkan, posisi GPS perangkatmu dipakai saat itu juga untuk mencari aktivitas terdekat. Posisi ini tidak pernah disimpan di database kami. Jika kamu memilih wilayah, hanya wilayah itu yang dipakai.",
        ],
      },
      {
        heading: "Untuk apa kami memakainya",
        body: [
          [
            "Menjalankan akunmu dan membuatmu bisa masuk dengan aman (pelaksanaan perjanjian denganmu).",
            "Menampilkan aktivitas di sekitarmu yang sesuai hobimu, serta memungkinkanmu membuat, mengikuti, dan membahas aktivitas (pelaksanaan perjanjian).",
            "Menjaga keamanan komunitas: mencegah penyalahgunaan, menangani laporan dan keluhan, serta mencatat tindakan admin di log audit (kepentingan yang sah dan kewajiban hukum).",
            "Mengirim email akun dan keamanan, seperti kode masuk dan pemberitahuan saat PIN atau kata sandi diubah (diperlukan untuk layanan).",
          ],
          "Kami tidak menjual datamu, tidak menampilkan iklan, dan tidak memakai pelacak analitik atau iklan.",
        ],
      },
      {
        heading: "Siapa yang bisa melihat datamu",
        body: [
          "Anggota lain melihat apa yang kamu pilih untuk ditampilkan: profil publik sesuai pengaturan privasimu, aktivitas yang kamu buat, dan komentarmu. Nama lengkap, nomor WhatsApp, usia, dan wilayah persismu tidak bisa dibaca anggota lain. Nomor WhatsApp penyelenggara hanya ditampilkan jika dibuat publik atau kepada peserta yang sudah disetujui.",
          "Moderator dan admin dapat mengakses data akun bila diperlukan untuk menangani laporan, keluhan, dan masalah keamanan. Setiap perubahan oleh admin dicatat di log audit.",
        ],
      },
      {
        heading: "Penyedia layanan",
        body: [
          "Kami memakai penyedia berikut untuk menjalankan Komunitas. Mereka hanya memproses data untuk menyediakan layanannya:",
          [
            "Supabase: database, proses masuk, penyimpanan file, dan pesan realtime.",
            "Vercel: hosting situs.",
            "Server peta OpenStreetMap dan Nominatim: gambar peta dan mengubah nama wilayah menjadi perkiraan titik. Mereka menerima alamat jaringanmu dan area peta yang kamu lihat.",
            "API emsifa (GitHub Pages): daftar wilayah Indonesia untuk pilihan wilayah.",
            "Google (SMTP Gmail): pengiriman email.",
          ],
          "WhatsApp hanya terbuka saat kamu mengetuk tautan WhatsApp. Sebagian penyedia dapat memproses data di luar Indonesia; kami memilih penyedia dengan langkah keamanan yang memadai.",
        ],
      },
      {
        heading: "Berapa lama kami menyimpannya",
        body: [
          "Kami menyimpan datamu selama akunmu aktif. Saat kamu menghapus akun, data profil pribadi, hobi, keikutsertaan, tautan sosial, PIN masuk, notifikasi, dan banner yang kamu unggah langsung dihapus, begitu juga login-mu. Aktivitasmu yang akan datang dibatalkan. Komentar dan pesan yang pernah kamu kirim tetap terlihat oleh penerimanya, ditampilkan sebagai dari pengguna yang dihapus. Catatan keluhan dan log audit admin disimpan selama diperlukan untuk alasan keamanan dan hukum.",
        ],
      },
      {
        heading: "Hak-hakmu",
        body: [
          "Kamu bisa melihat dan memperbaiki profilmu kapan saja di Profil, serta mengatur siapa yang bisa melihatnya di Profil → Privasi. Kamu bisa menghapus akun dan data pribadimu sendiri di Profil → Keamanan → Hapus akun. Kamu juga bisa meminta kami menjelaskan, memperbaiki, membatasi, atau menghapus datamu, atau menarik persetujuan, dengan mengirim email ke " + E + ". Kami membalas dalam 3 x 24 jam pada hari kerja, sesuai ketentuan undang-undang.",
        ],
      },
      {
        heading: "Keamanan",
        body: [
          "Akses ke data ditegakkan langsung di database dengan row-level security di setiap tabel. Kata sandi dan PIN di-hash, masuk dengan PIN dikunci setelah salah berulang kali, dan kunci rahasia hanya disimpan di server. Tidak ada sistem yang benar-benar aman; jika terjadi kebocoran yang memengaruhimu, kami akan memberi tahu kamu dan pihak berwenang sesuai ketentuan hukum.",
        ],
      },
      {
        heading: "Anak-anak",
        body: [
          "Komunitas ditujukan untuk orang dewasa. Jika kamu yakin seorang anak memberikan data pribadi kepada kami tanpa persetujuan orang tua atau wali, hubungi kami dan kami akan menghapusnya.",
        ],
      },
      {
        heading: "Perubahan",
        body: [
          "Jika kebijakan ini berubah, kami memperbarui tanggal di bagian atas, dan untuk perubahan penting, kami memberi tahu kamu di aplikasi.",
        ],
      },
    ],
  },
  terms: {
    title: "Syarat Layanan",
    summary: "Aturan memakai Komunitas, untuk peserta dan penyelenggara.",
    sections: [
      {
        heading: "Tentang syarat ini",
        body: [
          `Syarat ini adalah perjanjian antara kamu dan ${BUSINESS.operator}, yang menjalankan Komunitas sebagai proyek mahasiswa nonkomersial di ${BUSINESS.institution}. Dengan membuat akun, kamu menyetujui syarat ini dan Kebijakan Privasi kami.`,
        ],
      },
      {
        heading: "Akunmu",
        body: [
          [
            "Berikan informasi yang benar dan jaga kerahasiaan kata sandi serta PIN-mu. Kamu bertanggung jawab atas aktivitas di akunmu.",
            "Satu orang, satu akun. Jangan menyamar sebagai orang lain.",
            "Kamu bisa menghapus akunmu kapan saja di Profil → Keamanan.",
          ],
        ],
      },
      {
        heading: "Aktivitas dan penyelenggara",
        body: [
          "Komunitas membantu orang menemukan dan menyelenggarakan aktivitas. Kami tidak menjalankan aktivitas itu sendiri. Penyelenggara bertanggung jawab atas aktivitasnya: detail yang benar (tanggal, tempat, kuota, biaya), tempat yang aman, dan izin yang diperlukan. Peserta ikut atas risiko sendiri dan sebaiknya berhati-hati, terutama saat bertemu orang baru.",
          "Biaya apa pun ditampilkan di aktivitas sebelum kamu bergabung, dan dibayar langsung ke penyelenggara di luar Komunitas. Lihat Kebijakan Pengembalian Dana.",
        ],
      },
      {
        heading: "Penggunaan yang diperbolehkan",
        body: [
          "Jangan memakai Komunitas untuk:",
          [
            "melecehkan, mengancam, atau mendiskriminasi siapa pun;",
            "mengunggah konten ilegal, kebencian, seksual, atau kekerasan, spam, atau penipuan;",
            "membuat aktivitas palsu, atau menulis detail menyesatkan atau ulasan palsu;",
            "mengumpulkan data anggota lain, atau mencoba merusak atau membebani layanan.",
          ],
          "Laporkan apa pun yang melanggar aturan ini. Moderator dapat menghapus konten serta menangguhkan atau menonaktifkan akun yang melanggar.",
        ],
      },
      {
        heading: "Kontenmu",
        body: [
          "Kamu tetap memiliki apa yang kamu unggah. Kamu mengizinkan kami menyimpan dan menampilkannya di Komunitas agar layanan berjalan. Unggah hanya banner dan foto yang berhak kamu gunakan.",
        ],
      },
      {
        heading: "Layanan",
        body: [
          "Komunitas adalah proyek mahasiswa yang disediakan \"apa adanya\" dan gratis. Kami berusaha menjaganya tetap tersedia dan benar, tetapi tidak bisa menjamin layanan selalu berjalan, dan kami dapat mengubah atau menghentikan fitur. Sejauh diizinkan hukum, kami tidak bertanggung jawab atas kerugian yang timbul dari aktivitas yang diselenggarakan lewat Komunitas atau dari pemakaian layanan.",
        ],
      },
      {
        heading: "Hukum dan kontak",
        body: [
          `Syarat ini tunduk pada hukum Negara Republik Indonesia. Pertanyaan: ${E}.`,
        ],
      },
    ],
  },
  refunds: {
    title: "Kebijakan Pengembalian Dana",
    summary: "Cara kerja biaya dan pengembalian dana untuk aktivitas di Komunitas.",
    sections: [
      {
        heading: "Komunitas gratis",
        body: [
          "Memakai Komunitas tidak dipungut biaya. Kami tidak menarik biaya langganan atau biaya layanan, dan tidak pernah menerima pembayaran lewat aplikasi, jadi tidak ada biaya tersembunyi.",
        ],
      },
      {
        heading: "Biaya aktivitas",
        body: [
          "Sebagian penyelenggara menetapkan biaya untuk aktivitasnya, misalnya untuk sewa lapangan. Biaya selalu ditampilkan di aktivitas sebelum kamu bergabung (\"Gratis\" jika tidak ada). Kamu membayarnya langsung ke penyelenggara, di luar Komunitas.",
        ],
      },
      {
        heading: "Pengembalian dana",
        body: [
          [
            "Pengembalian biaya aktivitas adalah urusan antara kamu dan penyelenggara. Hubungi penyelenggara; narahubung dan WhatsApp-nya ditampilkan di aktivitas untuk peserta yang disetujui.",
            "Jika aktivitas dibatalkan, kami mengharapkan penyelenggara mengembalikan seluruh biaya yang sudah dibayar.",
            "Jika penyelenggara tidak menanggapi atau kamu mencurigai penipuan, laporkan aktivitas itu lewat Bantuan. Kami bisa menyelidiki serta menghapus aktivitas dan akun, tetapi tidak bisa melakukan atau membatalkan pembayaran sendiri.",
          ],
        ],
      },
    ],
  },
  cookies: {
    title: "Kebijakan Cookie",
    summary: "Cookie dan penyimpanan browser yang dipakai Komunitas. Semuanya benar-benar diperlukan; tidak ada cookie pelacak atau iklan.",
    sections: [
      {
        heading: "Pendekatan kami",
        body: [
          "Komunitas hanya memakai cookie dan penyimpanan browser yang dibutuhkan agar situs berjalan atau untuk mengingat pilihanmu. Kami tidak memakai cookie analitik, iklan, atau pelacak media sosial, jadi tidak ada yang perlu kamu tolak.",
        ],
      },
      {
        heading: "Cookie",
        body: [
          [
            "sb-…-auth-token (Supabase): membuatmu tetap masuk. Sesi, dihapus saat kamu keluar.",
            "komunitas-lang: bahasamu (Inggris atau Indonesia). 1 tahun.",
            "komunitas-theme: tema terang, gelap, atau sistem. 1 tahun.",
          ],
        ],
      },
      {
        heading: "Penyimpanan browser (localStorage)",
        body: [
          [
            "komunitas-lang: salinan pilihan bahasamu.",
            "komunitas-location: apakah kamu memakai GPS atau wilayah pilihan, dan wilayah itu. Posisi GPS langsungmu tidak disimpan.",
            "komunitas-wilayah-… dan komunitas-geocode-v1: cache daftar wilayah dan pencarian wilayah, agar pilihan wilayah lebih cepat dimuat.",
            "komunitas-cookie-notice: bahwa kamu sudah melihat pemberitahuan cookie.",
          ],
        ],
      },
      {
        heading: "Pihak ketiga",
        body: [
          "Gambar peta berasal dari server OpenStreetMap, yang menerima alamat jaringanmu seperti situs lain yang kamu buka, tetapi kami tidak membiarkan mereka memasang cookie pelacak lewat Komunitas.",
        ],
      },
      {
        heading: "Mengelola cookie",
        body: [
          "Kamu bisa menghapus cookie dan data situs di pengaturan browser. Jika kamu memblokirnya, kamu tidak bisa tetap masuk, dan situs akan lupa bahasa serta temamu.",
        ],
      },
    ],
  },
};

export const LEGAL: Record<Lang, Record<LegalDocKey, LegalDoc>> = { en, id };
