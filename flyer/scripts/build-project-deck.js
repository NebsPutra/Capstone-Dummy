// Builds the full project deck (aim, how to use, how it's built, data stores,
// results), 16:9 with speaker notes, Orange/Cream branding, in English or Indonesian.
// Usage: cd flyer/scripts && npm install
//   node build-project-deck.js      -> ../komunitas-project-deck.pptx     (English)
//   node build-project-deck.js id   -> "../PITCH DECK CAPSTONE.pptx"      (Bahasa Indonesia)
const path = require("path");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const QRCode = require("qrcode");
const fa = require("react-icons/fa");

const LANG = process.argv[2] === "id" ? "id" : "en";
/** Pick the string for the deck's language. */
const T = (en, id) => (LANG === "id" ? id : en);

const OUT = path.join(__dirname, "..", LANG === "id" ? "PITCH DECK CAPSTONE.pptx" : "komunitas-project-deck.pptx");
const LOGO = path.join(__dirname, "..", "a-team-logo.png");
const LANDING = path.join(__dirname, "..", "deck-assets", LANG === "id" ? "landing-id.png" : "landing.png");

const C = {
  cream: "FFF8ED", warm: "F8E8D0", peach: "FED7AA", orange: "F97316", deep: "C2410C",
  ink: "292524", body: "44403C", muted: "78716C", white: "FFFFFF", green: "16A34A", line: "EFE6DA",
};
const FONT = "Arial";
const W = 13.333;
const TOTAL = 24;

async function png(svg, w, h = w) {
  const buf = await sharp(Buffer.from(svg)).resize(w, h).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
const iconCache = new Map();
async function icon(Comp, color, size = 256) {
  const key = `${Comp.name}-${color}`;
  if (!iconCache.has(key)) iconCache.set(key, await png(renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size })), size));
  return iconCache.get(key);
}
async function gradient(w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FB923C"/><stop offset="1" stop-color="#C2410C"/></linearGradient>
      <radialGradient id="r" cx="0.85" cy="0.15" r="0.6"><stop offset="0" stop-color="#FFF8ED" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#FFF8ED" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#r)"/></svg>`;
  return png(svg, w, h);
}

const shadow = () => ({ type: "outer", color: "C2410C", blur: 14, offset: 3, angle: 90, opacity: 0.12 });
const text = (slide, t, o) => slide.addText(t, { fontFace: FONT, isTextBox: true, margin: 0, ...o });
const card = (pres, slide, x, y, w, h, fill = C.white) =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.2, fill: { color: fill }, line: { color: C.line, width: 0.75 }, shadow: shadow() });
const tile = (pres, slide, x, y, s, fill = C.orange) =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: s, h: s, rectRadius: s * 0.27, fill: { color: fill }, line: { type: "none" } });
const pill = (pres, slide, x, y, w, h, fill) =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: h / 2, fill: { color: fill }, line: { type: "none" } });
async function iconTile(pres, slide, Comp, x, y, s, fill = C.orange, color = C.cream) {
  tile(pres, slide, x, y, s, fill);
  const i = s * 0.52;
  slide.addImage({ data: await icon(Comp, color), x: x + (s - i) / 2, y: y + (s - i) / 2, w: i, h: i });
}
async function arrow(slide, x, y, s = 0.22) {
  slide.addImage({ data: await icon(fa.FaChevronRight, C.orange), x, y, w: s, h: s });
}

function header(slide, eyebrow, title) {
  text(slide, eyebrow.toUpperCase(), { x: 0.7, y: 0.5, w: 11, h: 0.35, fontSize: 13, bold: true, color: C.deep, charSpacing: 3 });
  text(slide, title, { x: 0.7, y: 0.85, w: 11.9, h: 0.8, fontSize: 34, bold: true, color: C.ink });
}
function footer(slide, n) {
  slide.addImage({ path: LOGO, x: 0.7, y: 6.87, w: 0.3, h: 0.3 });
  text(slide, T("Komunitas · Capstone Project · A Team", "Komunitas · Proyek Capstone · A Team"), { x: 1.1, y: 6.87, w: 6, h: 0.3, fontSize: 11, color: C.muted, valign: "middle" });
  text(slide, `${n} / ${TOTAL}`, { x: W - 1.7, y: 6.87, w: 1.0, h: 0.3, fontSize: 11, color: C.muted, align: "right", valign: "middle" });
}
function content(pres, n, eyebrow, title) {
  const s = pres.addSlide();
  s.background = { color: C.cream };
  header(s, eyebrow, title);
  footer(s, n);
  return s;
}
function sectionSlide(pres, grad, num, title, sub) {
  const s = pres.addSlide();
  s.background = { data: grad };
  text(s, num, { x: 0.8, y: 2.2, w: 3, h: 1.2, fontSize: 72, bold: true, color: C.peach });
  text(s, title, { x: 0.8, y: 3.35, w: 11.5, h: 1.1, fontSize: 54, bold: true, color: C.cream });
  text(s, sub, { x: 0.8, y: 4.5, w: 10.5, h: 0.6, fontSize: 20, color: C.cream });
  return s;
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = T("Komunitas: Project Overview", "Komunitas: Gambaran Proyek");
  pres.author = "A Team";
  pres.lang = LANG === "id" ? "id-ID" : "en-US";

  const grad = await gradient(1920, 1080);
  const logoCream = await png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="13" fill="#FFF8ED"/><path d="M12.5 37.5 24 11.5l11.5 26" fill="none" stroke="#EA580C" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.6 28.4Q24 34 30.4 28.4" fill="none" stroke="#EA580C" stroke-width="3.4" stroke-linecap="round"/></svg>`, 512);
  const qrSvg = await QRCode.toString("https://komunitasa.vercel.app", { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#292524", light: "#FFFFFF" } });
  const qr = await png(qrSvg, 800);
  const tagline = T("Find activities. Meet people. Build community.", "Temukan aktivitas. Temui orang baru. Bangun komunitas.");

  // 1. Title
  {
    const s = pres.addSlide();
    s.background = { data: grad };
    s.addImage({ data: logoCream, x: 0.8, y: 0.8, w: 1.0, h: 1.0 });
    text(s, T("CAPSTONE PROJECT · A TEAM", "PROYEK CAPSTONE · A TEAM"), { x: 0.8, y: 2.35, w: 10, h: 0.5, fontSize: 18, bold: true, color: C.peach, charSpacing: 5 });
    text(s, "Komunitas", { x: 0.8, y: 2.8, w: 11, h: 1.5, fontSize: 88, bold: true, color: C.cream });
    text(s, tagline, { x: 0.8, y: 4.35, w: 11.5, h: 0.6, fontSize: 26, color: C.cream });
    text(s, T("The whole project: aim, how to use it, how it's built, where data lives, and what we delivered.",
      "Seluruh proyek: tujuan, cara pakai, cara dibangun, tempat data disimpan, dan hasil akhirnya."), { x: 0.8, y: 5.0, w: 11, h: 0.5, fontSize: 16, color: C.peach });
    text(s, T("komunitasa.vercel.app   ·   Universitas Terbuka   ·   September 2026", "komunitasa.vercel.app   ·   Universitas Terbuka   ·   September 2026"), { x: 0.8, y: 6.45, w: 11, h: 0.4, fontSize: 15, bold: true, color: C.peach });
    s.addNotes(T(
      "Welcome. We're A Team, and this is Komunitas, our capstone project. This deck covers the whole project from the bottom up: why we built it, how people use it, how it's built, where the data is stored, and what we ended up delivering.",
      "Selamat datang. Kami A Team, dan ini Komunitas, proyek capstone kami. Presentasi ini membahas seluruh proyek dari dasar: mengapa kami membangunnya, bagaimana orang memakainya, bagaimana aplikasinya dibangun, di mana datanya disimpan, dan apa hasil akhirnya."));
  }

  // 2. Agenda
  {
    const s = content(pres, 2, T("Agenda", "Agenda"), T("What this deck covers", "Isi presentasi ini"));
    const items = [
      ["01", T("Aim & goals", "Tujuan & sasaran"), T("The problem and what we set out to do", "Masalahnya dan apa yang ingin kami capai")],
      ["02", T("How to use it", "Cara pakai"), T("Participants, organizers and admins", "Peserta, penyelenggara, dan admin")],
      ["03", T("How it's built", "Cara dibangun"), T("Architecture, stack and delivery pipeline", "Arsitektur, teknologi, dan alur rilis")],
      ["04", T("Data stores", "Penyimpanan data"), T("Where every piece of data lives, and how it's protected", "Di mana setiap data disimpan dan bagaimana dilindungi")],
      ["05", T("End results", "Hasil akhir"), T("What we shipped, by the numbers, and what's next", "Apa yang kami rilis, angka-angkanya, dan langkah berikutnya")],
    ];
    for (let i = 0; i < items.length; i++) {
      const y = 1.95 + i * 0.93;
      card(pres, s, 0.7, y, 11.9, 0.78);
      text(s, items[i][0], { x: 1.0, y, w: 0.9, h: 0.78, fontSize: 24, bold: true, color: C.orange, valign: "middle" });
      text(s, items[i][1], { x: 2.0, y, w: 3.8, h: 0.78, fontSize: 20, bold: true, color: C.ink, valign: "middle" });
      text(s, items[i][2], { x: 5.9, y, w: 6.5, h: 0.78, fontSize: 15, color: C.muted, valign: "middle" });
    }
    s.addNotes(T(
      "Five parts: aim and goals, how to use the app, how it's built, where the data lives, and the end results.",
      "Ada lima bagian: tujuan dan sasaran, cara memakai aplikasi, cara aplikasinya dibangun, tempat data disimpan, dan hasil akhirnya."));
  }

  // 3. Section: Aim
  sectionSlide(pres, grad, "01", T("Aim & goals", "Tujuan & sasaran"), T("Why Komunitas exists", "Mengapa Komunitas dibuat"))
    .addNotes(T("Part one: why we built Komunitas.", "Bagian pertama: mengapa kami membangun Komunitas."));

  // 4. Problem & aim
  {
    const s = content(pres, 4, T("The problem", "Masalahnya"), T("Local activities are hard to find and hard to run", "Aktivitas lokal sulit ditemukan dan sulit dikelola"));
    const probs = [
      [fa.FaSearch, T("Scattered", "Tersebar"), T(
        "Runs, book clubs and games are announced in private WhatsApp groups and social posts. If you're not in the group, you never hear about them.",
        "Lari bareng, klub buku, dan main bersama diumumkan di grup WhatsApp tertutup dan unggahan media sosial. Yang tidak ada di grup tidak pernah tahu.")],
      [fa.FaUserFriends, T("Hard to join", "Sulit ikut"), T(
        "Newcomers don't know who to ask, whether there's room, or whether it's even open to them.",
        "Pendatang baru tidak tahu harus bertanya ke siapa, apakah masih ada tempat, atau apakah acaranya terbuka untuk umum.")],
      [fa.FaClipboardCheck, T("Manual work", "Serba manual"), T(
        "Organizers track sign-ups, capacity and contact numbers by hand, in chats and spreadsheets.",
        "Penyelenggara mencatat pendaftar, kuota, dan nomor kontak secara manual lewat chat dan spreadsheet.")],
    ];
    for (let i = 0; i < probs.length; i++) {
      const y = 2.0 + i * 1.5;
      await iconTile(pres, s, probs[i][0], 0.7, y, 0.8, C.warm, C.deep);
      text(s, probs[i][1], { x: 1.75, y: y - 0.02, w: 5.3, h: 0.4, fontSize: 19, bold: true, color: C.ink });
      text(s, probs[i][2], { x: 1.75, y: y + 0.42, w: 5.3, h: 0.95, fontSize: 14, color: C.muted, valign: "top" });
    }
    card(pres, s, 7.5, 2.0, 5.1, 4.4, C.white);
    await iconTile(pres, s, fa.FaBullseye, 7.9, 2.4, 0.8);
    text(s, T("OUR AIM", "TUJUAN KAMI"), { x: 7.9, y: 3.45, w: 4.3, h: 0.35, fontSize: 13, bold: true, color: C.deep, charSpacing: 3 });
    text(s, T(
      "One place to discover, create and join social activities near you, based on your interests and location, while keeping your exact location private.",
      "Satu tempat untuk menemukan, membuat, dan mengikuti aktivitas sosial di sekitarmu, sesuai minat dan lokasimu, tanpa membuka lokasi persismu."),
      { x: 7.9, y: 3.85, w: 4.3, h: 2.3, fontSize: 19, bold: true, color: C.ink, valign: "top", lineSpacingMultiple: 1.1 });
    s.addNotes(T(
      "Today, local activities live in closed WhatsApp groups and scattered posts. Newcomers can't find them, and organizers do everything by hand. Our aim is one place to discover, create and join activities nearby, based on your interests and location, without ever storing your exact position.",
      "Saat ini aktivitas lokal ada di grup WhatsApp tertutup dan unggahan yang tersebar. Pendatang baru sulit menemukannya, dan penyelenggara mengerjakan semuanya secara manual. Tujuan kami adalah satu tempat untuk menemukan, membuat, dan mengikuti aktivitas terdekat sesuai minat dan lokasi, tanpa pernah menyimpan posisi persis pengguna."));
  }

  // 5. Goals
  {
    const s = content(pres, 5, T("Goals", "Sasaran"), T("Five goals the product had to meet", "Lima sasaran yang harus dipenuhi"));
    const goals = [
      ["20 km", T("Nearby first", "Utamakan terdekat"), T("The dashboard shows open activities within 20 km of you, matched to your hobbies.", "Dasbor menampilkan aktivitas dalam radius 20 km, sesuai hobimu.")],
      [T("1 tap", "1 klik"), T("Easy to join", "Mudah ikut"), T("Join open activities instantly, or request a spot when the organizer approves joiners.", "Langsung gabung ke aktivitas terbuka, atau ajukan permintaan jika perlu persetujuan.")],
      [T("4 ways", "4 cara"), T("Easy to share", "Mudah dibagikan"), T("Invite link, WhatsApp, QR code and a ready-made flyer for every activity.", "Tautan undangan, WhatsApp, kode QR, dan flyer siap pakai untuk tiap aktivitas.")],
      ["0", T("GPS stored", "GPS disimpan"), T("Your live location is used in the moment only and never saved to the database.", "Lokasi langsungmu hanya dipakai saat itu dan tidak pernah disimpan di database.")],
      ["EN · ID", T("Bilingual", "Dua bahasa"), T("Every screen in English and Bahasa Indonesia, switchable at any time.", "Semua layar tersedia dalam bahasa Inggris dan Indonesia, bisa diganti kapan saja.")],
    ];
    const cw = 2.2, gap = 0.225, y = 2.05, ch = 3.7;
    for (let i = 0; i < goals.length; i++) {
      const x = 0.7 + i * (cw + gap);
      card(pres, s, x, y, cw, ch);
      text(s, goals[i][0], { x: x + 0.25, y: y + 0.35, w: cw - 0.5, h: 0.95, fontSize: goals[i][0].length > 5 ? 30 : 40, bold: true, color: C.orange, valign: "middle" });
      text(s, goals[i][1], { x: x + 0.25, y: y + 1.35, w: cw - 0.5, h: 0.6, fontSize: 17, bold: true, color: C.ink, valign: "middle" });
      text(s, goals[i][2], { x: x + 0.25, y: y + 2.0, w: cw - 0.5, h: 1.55, fontSize: 13.5, color: C.muted, valign: "top" });
    }
    s.addNotes(T(
      "We turned the aim into five concrete goals: nearby-first discovery within 20 kilometres, joining in one tap, four ways to share, zero stored GPS positions, and full English and Indonesian support.",
      "Tujuan itu kami jabarkan menjadi lima sasaran: menampilkan aktivitas terdekat dalam radius 20 kilometer, bergabung dengan satu klik, empat cara berbagi, tidak ada posisi GPS yang disimpan, dan dukungan penuh bahasa Inggris dan Indonesia."));
  }

  // 6. Section: How to use
  sectionSlide(pres, grad, "02", T("How to use it", "Cara pakai"), T("For participants, organizers and admins", "Untuk peserta, penyelenggara, dan admin"))
    .addNotes(T("Part two: how people actually use Komunitas.", "Bagian kedua: bagaimana orang memakai Komunitas."));

  // 7. Meet the app (screenshot)
  {
    const s = content(pres, 7, T("Meet the app", "Kenalan dengan aplikasinya"), T("A mobile-first web app, no install needed", "Aplikasi web untuk ponsel, tanpa perlu instal"));
    card(pres, s, 0.7, 1.95, 7.4, 4.65, C.ink);
    s.addImage({ path: LANDING, x: 0.85, y: 2.1, w: 7.1, h: 4.4375 });
    const pts = [
      [fa.FaMobileAlt, T("Works in any browser", "Jalan di browser apa pun"), T("Phone first, with a bottom nav on mobile and a sidebar on desktop.", "Diutamakan untuk ponsel: menu bawah di ponsel, sidebar di desktop.")],
      [fa.FaPalette, T("Light, dark or system", "Terang, gelap, atau sistem"), T("Warm orange and cream design, Plus Jakarta Sans.", "Desain oranye dan krem yang hangat, font Plus Jakarta Sans.")],
      [fa.FaLanguage, T("English / Indonesian", "Inggris / Indonesia"), T("Switch language from the header on any page.", "Ganti bahasa dari header di halaman mana pun.")],
      [fa.FaGlobe, T("Always up to date", "Selalu terbaru"), T("Live at komunitasa.vercel.app, updated on every release.", "Aktif di komunitasa.vercel.app, diperbarui setiap rilis.")],
    ];
    for (let i = 0; i < pts.length; i++) {
      const y = 2.0 + i * 1.15;
      await iconTile(pres, s, pts[i][0], 8.5, y, 0.7);
      text(s, pts[i][1], { x: 9.4, y: y - 0.03, w: 3.3, h: 0.38, fontSize: 16, bold: true, color: C.ink });
      text(s, pts[i][2], { x: 9.4, y: y + 0.35, w: 3.3, h: 0.7, fontSize: 12.5, color: C.muted, valign: "top" });
    }
    s.addNotes(T(
      "This is the live landing page. Komunitas is a web app, so there's nothing to install. It's designed for phones first, has light and dark themes, and every screen is available in English and Indonesian.",
      "Ini halaman depan yang sedang aktif. Komunitas adalah aplikasi web, jadi tidak perlu diinstal. Aplikasinya dirancang untuk ponsel, punya tema terang dan gelap, dan semua layarnya tersedia dalam bahasa Inggris dan Indonesia."));
  }

  // 8. Roles
  {
    const s = content(pres, 8, T("Who uses it", "Siapa penggunanya"), T("Five roles, each with clear permissions", "Lima peran, masing-masing dengan hak akses jelas"));
    const roles = [
      [fa.FaUserCircle, T("Participant", "Peserta"), T("Discovers, joins, comments and messages. Every new member starts here.", "Mencari, bergabung, berkomentar, dan berkirim pesan. Semua anggota baru mulai dari sini.")],
      [fa.FaUserTie, T("Organizer", "Penyelenggara"), T("Any participant who creates an activity: edits it, approves joiners, shares it, makes flyers.", "Peserta yang membuat aktivitas: mengubahnya, menyetujui peserta, membagikannya, membuat flyer.")],
      [fa.FaUserShield, T("Moderator", "Moderator"), T("Handles complaints and reported comments or messages.", "Menangani keluhan serta komentar atau pesan yang dilaporkan.")],
      [fa.FaUserCog, T("Admin", "Admin"), T("Also manages users, events, categories, settings and data exports.", "Juga mengelola pengguna, aktivitas, kategori, pengaturan, dan ekspor data.")],
      [fa.FaCrown, T("Super admin", "Super admin"), T("Also changes roles and anonymizes users. Every admin action is audited.", "Juga mengubah peran dan menganonimkan pengguna. Semua tindakan admin dicatat.")],
    ];
    const cw = 2.2, gap = 0.225, y = 2.05, ch = 4.3;
    for (let i = 0; i < roles.length; i++) {
      const x = 0.7 + i * (cw + gap);
      card(pres, s, x, y, cw, ch, i === 1 ? C.warm : C.white);
      await iconTile(pres, s, roles[i][0], x + 0.3, y + 0.35, 0.8, i === 1 ? C.deep : C.orange);
      text(s, roles[i][1], { x: x + 0.3, y: y + 1.4, w: cw - 0.45, h: 0.5, fontSize: 16, bold: true, color: C.ink });
      text(s, roles[i][2], { x: x + 0.3, y: y + 1.95, w: cw - 0.55, h: 2.2, fontSize: 13.5, color: C.muted, valign: "top" });
    }
    s.addNotes(T(
      "There are five roles. Participants and organizers are the same people: anyone who creates an activity becomes its organizer. Moderators, admins and super admins work in the admin area, with more power at each level. Permissions are enforced in the database, not only in the screens.",
      "Ada lima peran. Peserta dan penyelenggara adalah orang yang sama: siapa pun yang membuat aktivitas menjadi penyelenggaranya. Moderator, admin, dan super admin bekerja di area admin, dengan wewenang yang makin besar di tiap tingkat. Hak akses ditegakkan di database, bukan hanya di tampilan."));
  }

  // 9. Participant journey
  {
    const s = content(pres, 9, T("How to use · participants", "Cara pakai · peserta"), T("From sign-up to showing up in five steps", "Dari daftar sampai datang, dalam lima langkah"));
    const steps = [
      [fa.FaUserPlus, T("Sign up", "Daftar"), T("Email, password and a 6-digit code sent by email. Then set a 6-digit PIN for quick sign-in.", "Email, kata sandi, dan kode 6 digit lewat email. Lalu buat PIN 6 digit untuk masuk cepat.")],
      [fa.FaHeart, T("Pick hobbies", "Pilih hobi"), T("Choose interests such as running, reading, cycling, badminton or basketball.", "Pilih minat seperti lari, membaca, bersepeda, bulu tangkis, atau basket.")],
      [fa.FaMapMarkerAlt, T("Find nearby", "Cari terdekat"), T("Use live GPS or pick your area. The dashboard lists activities within 20 km.", "Pakai GPS atau pilih wilayahmu. Dasbor menampilkan aktivitas dalam 20 km.")],
      [fa.FaHandshake, T("Join", "Gabung"), T("Join in one tap, or request a spot. Get notified when you're approved.", "Gabung dengan satu klik, atau ajukan permintaan. Dapat notifikasi saat disetujui.")],
      [fa.FaComments, T("Meet up", "Ketemuan"), T("Ask questions in comments, message people privately, and add friends.", "Bertanya lewat komentar, kirim pesan pribadi, dan tambah teman.")],
    ];
    const cw = 2.15, gap = 0.3, y = 2.1, ch = 3.75;
    for (let i = 0; i < steps.length; i++) {
      const x = 0.7 + i * (cw + gap);
      card(pres, s, x, y, cw, ch);
      await iconTile(pres, s, steps[i][0], x + 0.3, y + 0.35, 0.75);
      text(s, String(i + 1).padStart(2, "0"), { x: x + 1.2, y: y + 0.35, w: 0.8, h: 0.75, fontSize: 20, bold: true, color: C.deep, valign: "middle" });
      text(s, steps[i][1], { x: x + 0.3, y: y + 1.35, w: cw - 0.5, h: 0.45, fontSize: 18, bold: true, color: C.ink });
      text(s, steps[i][2], { x: x + 0.3, y: y + 1.9, w: cw - 0.55, h: 1.75, fontSize: 13, color: C.muted, valign: "top" });
      if (i < steps.length - 1) await arrow(s, x + cw + 0.04, y + ch / 2 - 0.11);
    }
    s.addNotes(T(
      "A participant signs up with email, a password and an emailed code, then sets a PIN for quick sign-in. They choose hobbies, then share their location or pick their area to see activities within 20 kilometres. They join in one tap or request a spot, and then use comments, private messages and friends to connect.",
      "Peserta mendaftar dengan email, kata sandi, dan kode yang dikirim lewat email, lalu membuat PIN untuk masuk cepat. Setelah memilih hobi, mereka membagikan lokasi atau memilih wilayah untuk melihat aktivitas dalam radius 20 kilometer. Mereka bisa langsung bergabung atau mengajukan permintaan, lalu terhubung lewat komentar, pesan pribadi, dan daftar teman."));
  }

  // 10. Organizer journey
  {
    const s = content(pres, 10, T("How to use · organizers", "Cara pakai · penyelenggara"), T("Create, share and run an activity", "Buat, bagikan, dan jalankan aktivitas"));
    const steps = [
      [fa.FaPlusCircle, T("Create", "Buat"), T("Title, category, date and time, fee, capacity, and a pin on the map. Upload and crop a banner.", "Judul, kategori, tanggal dan jam, biaya, kuota, dan titik di peta. Unggah dan potong banner.")],
      [fa.FaLock, T("Set the rules", "Atur aturan"), T("Public or private. Open joining, or approval required. Add a contact person and WhatsApp.", "Publik atau privat. Bebas gabung atau perlu persetujuan. Tambahkan narahubung dan WhatsApp.")],
      [fa.FaShareAlt, T("Share", "Bagikan"), T("Invite link, WhatsApp, QR code, or a flyer in 9:16, 1:1 or 16:9 as PNG or JPG.", "Tautan undangan, WhatsApp, kode QR, atau flyer 9:16, 1:1, atau 16:9 dalam PNG atau JPG.")],
      [fa.FaClipboardCheck, T("Manage", "Kelola"), T("Approve or decline requests, answer comments, edit details, or cancel.", "Setujui atau tolak permintaan, jawab komentar, ubah detail, atau batalkan.")],
    ];
    const cw = 2.75, gap = 0.3, y = 2.0, ch = 3.25;
    for (let i = 0; i < steps.length; i++) {
      const x = 0.7 + i * (cw + gap);
      card(pres, s, x, y, cw, ch);
      await iconTile(pres, s, steps[i][0], x + 0.3, y + 0.3, 0.72);
      text(s, steps[i][1], { x: x + 1.2, y: y + 0.3, w: cw - 1.4, h: 0.72, fontSize: 19, bold: true, color: C.ink, valign: "middle" });
      text(s, steps[i][2], { x: x + 0.3, y: y + 1.25, w: cw - 0.6, h: 1.9, fontSize: 13.5, color: C.muted, valign: "top" });
      if (i < steps.length - 1) await arrow(s, x + cw + 0.04, y + ch / 2 - 0.11);
    }
    text(s, T("The status updates itself as people join and time passes:", "Status berubah sendiri seiring peserta bergabung dan waktu berjalan:"), { x: 0.7, y: 5.5, w: 9, h: 0.35, fontSize: 13, bold: true, color: C.body });
    const st = [[T("Open", "Dibuka"), C.green], [T("Almost full", "Hampir penuh"), C.orange], [T("Full", "Penuh"), C.deep], [T("Ongoing", "Berlangsung"), "2563EB"], [T("Completed", "Selesai"), C.muted]];
    let px = 0.7;
    for (let i = 0; i < st.length; i++) {
      const w = 0.55 + st[i][0].length * 0.1;
      pill(pres, s, px, 5.95, w, 0.45, C.white);
      s.addShape(pres.shapes.OVAL, { x: px + 0.17, y: 6.105, w: 0.14, h: 0.14, fill: { color: st[i][1] }, line: { type: "none" } });
      text(s, st[i][0], { x: px + 0.38, y: 5.95, w: w - 0.45, h: 0.45, fontSize: 12.5, bold: true, color: C.ink, valign: "middle" });
      px += w + 0.12;
      if (i < st.length - 1) { await arrow(s, px - 0.02, 6.07, 0.2); px += 0.3; }
    }
    text(s, T("(or Cancelled)", "(atau Dibatalkan)"), { x: px + 0.1, y: 5.95, w: 2.0, h: 0.45, fontSize: 12.5, color: C.muted, valign: "middle" });
    s.addNotes(T(
      "Organizers fill in the activity details, drop a pin on the map and crop a banner. They choose whether it's public or private and whether joiners need approval. Then they share it by link, WhatsApp, QR code or a generated flyer, and manage requests and comments. The status moves from open to almost full, full, ongoing and completed by itself.",
      "Penyelenggara mengisi detail aktivitas, menandai lokasi di peta, dan memotong banner. Mereka memilih apakah aktivitasnya publik atau privat, dan apakah peserta perlu disetujui. Lalu aktivitas dibagikan lewat tautan, WhatsApp, kode QR, atau flyer, dan penyelenggara mengelola permintaan serta komentar. Statusnya berubah sendiri dari dibuka, hampir penuh, penuh, berlangsung, sampai selesai."));
  }

  // 11. Features map
  {
    const s = content(pres, 11, T("Everything in the app", "Semua fitur aplikasi"), T("Feature map", "Peta fitur"));
    const f = [
      [fa.FaCompass, T("Nearby dashboard", "Dasbor terdekat"), T("Activities within 20 km, matched to your hobbies", "Aktivitas dalam 20 km, sesuai hobimu")],
      [fa.FaSearch, T("Explore & search", "Jelajahi & cari"), T("Any distance; search by name, place or event code", "Jarak berapa pun; cari nama, tempat, atau kode")],
      [fa.FaCalendarAlt, T("My activities", "Aktivitas saya"), T("What you organize and join, with check-in and ratings", "Yang kamu selenggarakan dan ikuti, dengan check-in dan penilaian")],
      [fa.FaQrcode, T("Share & invite", "Bagikan & undang"), T("Link, WhatsApp, QR code and flyer generator", "Tautan, WhatsApp, kode QR, dan pembuat flyer")],
      [fa.FaComments, T("Comments", "Komentar"), T("Questions and replies on each activity, with reporting", "Tanya jawab di tiap aktivitas, bisa dilaporkan")],
      [fa.FaEnvelopeOpenText, T("Private messages", "Pesan pribadi"), T("Realtime 1:1 chat, mute, archive and block", "Chat 1:1 langsung, bisukan, arsipkan, blokir")],
      [fa.FaUserFriends, T("Community", "Komunitas"), T("Profiles, friends, groups, and which friends are going", "Profil, teman, grup, dan teman yang ikut")],
      [fa.FaBell, T("Notifications", "Notifikasi"), T("Reminders, alerts and approvals, by email and push", "Pengingat, peringatan, dan persetujuan, via email dan push")],
      [fa.FaLifeRing, T("Help & support", "Bantuan"), T("Complaint tickets with attachments, emailed to admins", "Tiket keluhan dengan lampiran, dikirim ke admin")],
    ];
    const cw = 3.85, ch = 1.3, gx = 0.175, gy = 0.2;
    for (let i = 0; i < f.length; i++) {
      const x = 0.7 + (i % 3) * (cw + gx), y = 1.95 + Math.floor(i / 3) * (ch + gy);
      card(pres, s, x, y, cw, ch);
      await iconTile(pres, s, f[i][0], x + 0.25, y + 0.28, 0.72, C.warm, C.deep);
      text(s, f[i][1], { x: x + 1.15, y: y + 0.22, w: cw - 1.35, h: 0.4, fontSize: 16, bold: true, color: C.ink });
      text(s, f[i][2], { x: x + 1.15, y: y + 0.6, w: cw - 1.35, h: 0.6, fontSize: 12.5, color: C.muted, valign: "top" });
    }
    s.addNotes(T(
      "Here's everything in the app on one slide: the nearby dashboard, explore and search, my activities with check-in and ratings, sharing, comments, private messages, community profiles, friends and groups, notifications by email and phone push, and help and support tickets.",
      "Ini semua fitur aplikasi dalam satu slide: dasbor aktivitas terdekat, jelajahi dan cari, aktivitas saya dengan check-in dan penilaian, berbagi, komentar, pesan pribadi, profil komunitas, teman dan grup, notifikasi lewat email dan push di ponsel, serta tiket bantuan."));
  }

  // 12. Section: How it's built
  sectionSlide(pres, grad, "03", T("How it's built", "Cara dibangun"), T("Architecture, stack and delivery", "Arsitektur, teknologi, dan rilis"))
    .addNotes(T("Part three: how it's built.", "Bagian ketiga: bagaimana aplikasinya dibangun."));

  // 13. Architecture
  {
    const s = content(pres, 13, T("Architecture", "Arsitektur"), T("Three layers, with security in the database", "Tiga lapisan, keamanan ada di database"));
    const box = async (x, y, w, h, Comp, title, lines, fill = C.white) => {
      card(pres, s, x, y, w, h, fill);
      await iconTile(pres, s, Comp, x + 0.25, y + 0.25, 0.6);
      text(s, title, { x: x + 1.0, y: y + 0.25, w: w - 1.2, h: 0.6, fontSize: 16, bold: true, color: C.ink, valign: "middle" });
      text(s, lines.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < lines.length - 1 } })), { x: x + 0.25, y: y + 1.0, w: w - 0.45, h: h - 1.15, fontSize: 12.5, color: C.body, valign: "top", paraSpaceAfter: 4 });
    };
    await box(0.7, 2.0, 3.4, 3.2, fa.FaMobileAlt, T("Browser", "Browser"), [
      T("React 19 pages and forms", "Halaman dan formulir React 19"),
      T("Live GPS read on the device", "GPS dibaca di perangkat"),
      T("Leaflet maps (OpenStreetMap)", "Peta Leaflet (OpenStreetMap)"),
      T("Flyer and chart images drawn here", "Gambar flyer dan grafik dibuat di sini"),
    ]);
    await box(4.95, 2.0, 3.4, 3.2, fa.FaServer, "Vercel · Next.js 16", [
      T("Server-rendered pages (App Router)", "Halaman dirender di server (App Router)"),
      T("5 API routes: PIN sign-in, PIN recovery, alert emails", "5 rute API: masuk PIN, pemulihan PIN, email peringatan"),
      T("Login check on every request", "Cek login di setiap permintaan"),
      T("Secrets kept server-side", "Kunci rahasia hanya di server"),
    ]);
    await box(9.2, 2.0, 3.4, 3.2, fa.FaDatabase, "Supabase", [
      T("Postgres + row-level security", "Postgres + row-level security"),
      T("Auth: accounts, sessions, email codes", "Auth: akun, sesi, kode email"),
      T("Storage: banners, attachments", "Storage: banner, lampiran"),
      T("Realtime: live messages", "Realtime: pesan langsung"),
    ]);
    const conn = (x1, x2, y, label) => {
      s.addShape(pres.shapes.LINE, { x: x1, y, w: x2 - x1, h: 0, line: { color: C.orange, width: 2, beginArrowType: "triangle", endArrowType: "triangle" } });
      text(s, label, { x: x1 - 0.2, y: y - 0.38, w: x2 - x1 + 0.4, h: 0.3, fontSize: 10.5, color: C.muted, align: "center" });
    };
    conn(4.15, 4.9, 3.6, "HTTPS");
    conn(8.4, 9.15, 3.6, "SQL · RPC");
    const ext = [
      [fa.FaMap, "OpenStreetMap", T("Map tiles and area lookup", "Peta dan pencarian wilayah")],
      [fa.FaEnvelope, T("SMTP email", "Email SMTP"), T("Sign-in codes, complaint alerts", "Kode masuk, notifikasi keluhan")],
      [fa.FaGithub, "GitHub", T("Code, history, triggers deploys", "Kode, riwayat, pemicu rilis")],
    ];
    for (let i = 0; i < ext.length; i++) {
      const x = 0.7 + i * 4.25;
      pill(pres, s, x, 5.55, 3.4, 0.85, C.white);
      await iconTile(pres, s, ext[i][0], x + 0.15, 5.66, 0.63, C.warm, C.deep);
      text(s, ext[i][1], { x: x + 0.95, y: 5.62, w: 2.35, h: 0.35, fontSize: 12.5, bold: true, color: C.ink });
      text(s, ext[i][2], { x: x + 0.95, y: 5.95, w: 2.35, h: 0.35, fontSize: 11, color: C.muted });
    }
    s.addNotes(T(
      "The app has three layers. The browser runs the React interface, reads GPS on the device and draws maps and images. Vercel runs Next.js: it renders pages on the server, checks the login on every request, and hosts five small API routes. Supabase holds the database, sign-in, file storage and realtime messaging. Around it we use OpenStreetMap for maps, an SMTP service for emails, and GitHub for the code.",
      "Aplikasi ini punya tiga lapisan. Browser menjalankan tampilan React, membaca GPS di perangkat, serta menggambar peta dan gambar. Vercel menjalankan Next.js: merender halaman di server, mengecek login di setiap permintaan, dan menampung lima rute API kecil. Supabase menyimpan database, proses masuk, file, dan pesan realtime. Di sekitarnya kami memakai OpenStreetMap untuk peta, layanan SMTP untuk email, dan GitHub untuk kode."));
  }

  // 14. Tech stack
  {
    const s = content(pres, 14, T("Tech stack", "Teknologi"), T("Modern, free-tier friendly tools", "Alat modern yang ramah paket gratis"));
    const rows = [
      [fa.FaReact, "Next.js 16 · React 19 · TypeScript", T("App Router, server components; one typed codebase for pages and API routes.", "App Router, server components; satu kode bertipe untuk halaman dan rute API.")],
      [fa.FaPalette, "Tailwind CSS 3", T("Design tokens for the Orange/Cream palette, light and dark themes.", "Token desain untuk palet Oranye/Krem, tema terang dan gelap.")],
      [fa.FaDatabase, "Supabase", T("Postgres, Auth, Storage, Realtime. Rules live in SQL: RLS and security-definer functions.", "Postgres, Auth, Storage, Realtime. Aturan ada di SQL: RLS dan fungsi security-definer.")],
      [fa.FaMap, "Leaflet + OpenStreetMap", T("Maps and place lookup with no API key and no cost.", "Peta dan pencarian tempat tanpa API key dan tanpa biaya.")],
      [fa.FaChartBar, "Recharts · ExcelJS · docx", T("Admin charts, and Excel and Word exports built in the browser.", "Grafik admin, serta ekspor Excel dan Word yang dibuat di browser.")],
      [fa.FaQrcode, "qrcode.react · html-to-image", T("QR codes, and PNG/JPG export for charts and flyers.", "Kode QR, serta ekspor PNG/JPG untuk grafik dan flyer.")],
    ];
    for (let i = 0; i < rows.length; i++) {
      const col = i % 2, r = Math.floor(i / 2);
      const x = 0.7 + col * 6.1, y = 2.0 + r * 1.5;
      card(pres, s, x, y, 5.8, 1.3);
      await iconTile(pres, s, rows[i][0], x + 0.25, y + 0.28, 0.74);
      text(s, rows[i][1], { x: x + 1.2, y: y + 0.2, w: 4.4, h: 0.4, fontSize: 15.5, bold: true, color: C.ink });
      text(s, rows[i][2], { x: x + 1.2, y: y + 0.6, w: 4.4, h: 0.6, fontSize: 12.5, color: C.muted, valign: "top" });
    }
    s.addNotes(T(
      "The stack: Next.js 16 with React 19 and TypeScript, Tailwind for styling, Supabase for the backend, Leaflet and OpenStreetMap for maps, Recharts and ExcelJS for admin reports, and qrcode.react plus html-to-image for QR codes and flyers.",
      "Teknologinya: Next.js 16 dengan React 19 dan TypeScript, Tailwind untuk tampilan, Supabase untuk backend, Leaflet dan OpenStreetMap untuk peta, Recharts dan ExcelJS untuk laporan admin, serta qrcode.react dan html-to-image untuk kode QR dan flyer."));
  }

  // 15. Delivery pipeline
  {
    const s = content(pres, 15, T("How we build & ship", "Cara kami membangun & merilis"), T("Every change is checked before it goes live", "Setiap perubahan dicek sebelum tayang"));
    const steps = [
      [fa.FaTerminal, T("Code locally", "Kode di laptop"), T("npm run dev at localhost:3000", "npm run dev di localhost:3000")],
      [fa.FaCheckDouble, T("Check", "Cek"), T("Lint (0 errors), type check, production build", "Lint (0 error), cek tipe, build produksi")],
      [fa.FaCodeBranch, T("Push to main", "Push ke main"), T("GitHub: NebsPutra/Capstone-Dummy", "GitHub: NebsPutra/Capstone-Dummy")],
      [fa.FaRocket, T("Auto-deploy", "Rilis otomatis"), T("Vercel builds and publishes in about a minute", "Vercel membangun dan menerbitkan dalam semenit")],
      [fa.FaGlobe, T("Live", "Tayang"), T("Everyone gets the new version", "Semua orang dapat versi baru")],
    ];
    const cw = 2.15, gap = 0.3, y = 2.0, ch = 2.35;
    for (let i = 0; i < steps.length; i++) {
      const x = 0.7 + i * (cw + gap);
      card(pres, s, x, y, cw, ch, i === 4 ? C.warm : C.white);
      await iconTile(pres, s, steps[i][0], x + 0.3, y + 0.3, 0.68);
      text(s, steps[i][1], { x: x + 0.3, y: y + 1.12, w: cw - 0.45, h: 0.4, fontSize: 16, bold: true, color: C.ink });
      text(s, steps[i][2], { x: x + 0.3, y: y + 1.52, w: cw - 0.5, h: 0.75, fontSize: 12, color: C.muted, valign: "top" });
      if (i < steps.length - 1) await arrow(s, x + cw + 0.04, y + ch / 2 - 0.11);
    }
    card(pres, s, 0.7, 4.7, 11.9, 1.85);
    await iconTile(pres, s, fa.FaDatabase, 1.0, 5.0, 0.72, C.warm, C.deep);
    text(s, T("Database changes follow their own path", "Perubahan database punya jalurnya sendiri"), { x: 1.95, y: 4.95, w: 10.3, h: 0.4, fontSize: 16, bold: true, color: C.ink });
    text(s, T(
      "Each change is a numbered SQL file (schema.sql, then migrations 002 to 010). Every file is safe to run twice, and a team member runs it by hand, in order, in the Supabase SQL Editor. Secrets live only in Vercel and on the developer's machine, never in GitHub.",
      "Setiap perubahan berupa file SQL bernomor (schema.sql, lalu migrasi 002 sampai 010). Setiap file aman dijalankan dua kali, dan anggota tim menjalankannya secara manual dan berurutan di SQL Editor Supabase. Kunci rahasia hanya ada di Vercel dan laptop pengembang, tidak pernah di GitHub."),
      { x: 1.95, y: 5.38, w: 10.3, h: 1.0, fontSize: 13, color: C.muted, valign: "top" });
    s.addNotes(T(
      "We code locally, then run three checks: lint, type check and a full production build. Pushing to the main branch on GitHub makes Vercel build and publish automatically, so a push is a release. Database changes are separate: numbered SQL migrations, each safe to re-run, applied by hand in the Supabase SQL editor.",
      "Kami menulis kode di laptop, lalu menjalankan tiga pengecekan: lint, cek tipe, dan build produksi. Push ke branch main di GitHub membuat Vercel membangun dan menerbitkan aplikasi secara otomatis, jadi setiap push adalah rilis. Perubahan database terpisah: migrasi SQL bernomor yang aman dijalankan ulang, diterapkan secara manual di SQL Editor Supabase."));
  }

  // 16. Section: Data
  sectionSlide(pres, grad, "04", T("Data stores", "Penyimpanan data"), T("Where data lives and how it's protected", "Di mana data disimpan dan bagaimana dilindungi"))
    .addNotes(T("Part four: the data.", "Bagian keempat: data."));

  // 17. Data stores overview
  {
    const s = content(pres, 17, T("Data stores", "Penyimpanan data"), T("Five places data lives", "Lima tempat data disimpan"));
    const stores = [
      [fa.FaDatabase, "Supabase Postgres", T("41 tables · 2 views", "41 tabel · 2 view"), T(
        "Profiles, activities, participants, comments, messages, complaints, notifications, audit log. Row-level security on every table.",
        "Profil, aktivitas, peserta, komentar, pesan, keluhan, notifikasi, log audit. Row-level security di setiap tabel."), C.warm],
      [fa.FaFingerprint, "Supabase Auth", T("Accounts & sessions", "Akun & sesi"), T(
        "Email and password, 6-digit email codes, sessions. The sign-in PIN is stored separately, bcrypt-hashed.",
        "Email dan kata sandi, kode email 6 digit, sesi. PIN masuk disimpan terpisah dengan hash bcrypt."), C.white],
      [fa.FaHdd, "Supabase Storage", T("2 file buckets", "2 bucket file"), T(
        "event-banners (public images) and complaint-attachments (private, staff and reporter only).",
        "event-banners (gambar publik) dan complaint-attachments (privat, hanya staf dan pelapor)."), C.white],
      [fa.FaCookieBite, T("The user's device", "Perangkat pengguna"), T("Cookie & browser", "Cookie & browser"), T(
        "Language choice and the chosen area or GPS preference. Live GPS stays on the device.",
        "Pilihan bahasa dan wilayah atau preferensi GPS. GPS langsung tetap di perangkat."), C.white],
      [fa.FaKey, T("Vercel environment", "Environment Vercel"), T("Server secrets", "Kunci rahasia server"), T(
        "Service-role key, SMTP password and the push-notification key. Server-only, never sent to browsers or committed.",
        "Service-role key, kata sandi SMTP, dan kunci notifikasi push. Hanya di server, tidak dikirim ke browser atau ke GitHub."), C.white],
    ];
    const cw = 2.2, gap = 0.225, y = 2.0, ch = 4.4;
    for (let i = 0; i < stores.length; i++) {
      const x = 0.7 + i * (cw + gap);
      card(pres, s, x, y, cw, ch, stores[i][4]);
      await iconTile(pres, s, stores[i][0], x + 0.28, y + 0.3, 0.75, i === 0 ? C.deep : C.orange);
      text(s, stores[i][1], { x: x + 0.28, y: y + 1.25, w: cw - 0.5, h: 0.65, fontSize: 16, bold: true, color: C.ink, valign: "top" });
      text(s, stores[i][2], { x: x + 0.28, y: y + 1.9, w: cw - 0.5, h: 0.35, fontSize: 12, bold: true, color: C.deep });
      text(s, stores[i][3], { x: x + 0.28, y: y + 2.3, w: cw - 0.5, h: 2.0, fontSize: 12, color: C.muted, valign: "top" });
    }
    s.addNotes(T(
      "Data lives in five places. The main one is the Supabase Postgres database with 41 tables, all protected by row-level security. Supabase Auth holds accounts and sessions. Supabase Storage holds banner images and complaint attachments. The user's own device keeps their language and location preference; live GPS never leaves it. And Vercel holds the few server secrets.",
      "Data disimpan di lima tempat. Yang utama adalah database Postgres di Supabase dengan 41 tabel, semuanya dilindungi row-level security. Supabase Auth menyimpan akun dan sesi. Supabase Storage menyimpan gambar banner dan lampiran keluhan. Perangkat pengguna menyimpan pilihan bahasa dan lokasi; GPS langsung tidak pernah keluar dari perangkat. Dan Vercel menyimpan beberapa kunci rahasia server."));
  }

  // 18. Data model
  {
    const s = content(pres, 18, T("Data model", "Model data"), T("41 tables in five groups", "41 tabel dalam lima kelompok"));
    const groups = [
      [fa.FaIdCard, T("People", "Pengguna"), ["profiles", "interests", "user_interests", "user_pins", "privacy_settings", "social_links", "friendships", "user_blocks", "username_history", "reserved_usernames"]],
      [fa.FaTicketAlt, T("Activities", "Aktivitas"), ["events", "categories", "event_participants", "event_contacts", "event_waitlist", "event_checkin_codes", "event_ratings", "event_comments", "comment_reports"]],
      [fa.FaComments, T("Groups & chat", "Grup & pesan"), ["groups", "group_members", "play_requests", "play_request_interests", "conversations", "conversation_members", "messages", "message_reports"]],
      [fa.FaLifeRing, T("Support", "Bantuan"), ["complaints", "complaint_messages", "complaint_attachments", "complaint_status_history", "notifications", "notification_prefs", "push_subscriptions", "calendar_tokens"]],
      [fa.FaUserShield, T("Admin & safety", "Admin & keamanan"), ["audit_logs", "security_events", "admin_events", "platform_settings", "saved_views", "export_jobs"]],
    ];
    const cw = 2.2, gap = 0.225, y = 1.95, ch = 4.55;
    for (let i = 0; i < groups.length; i++) {
      const x = 0.7 + i * (cw + gap);
      card(pres, s, x, y, cw, ch);
      await iconTile(pres, s, groups[i][0], x + 0.25, y + 0.25, 0.6);
      text(s, groups[i][1], { x: x + 0.95, y: y + 0.25, w: cw - 1.05, h: 0.6, fontSize: 15, bold: true, color: C.ink, valign: "middle" });
      text(s, T(`${groups[i][2].length} tables`, `${groups[i][2].length} tabel`), { x: x + 0.25, y: y + 0.95, w: cw - 0.5, h: 0.3, fontSize: 11.5, bold: true, color: C.deep });
      text(s, groups[i][2].map((t, j) => ({ text: t, options: { breakLine: j < groups[i][2].length - 1 } })), { x: x + 0.25, y: y + 1.32, w: cw - 0.4, h: ch - 1.45, fontSize: 10.5, color: C.body, valign: "top", paraSpaceAfter: 3 });
    }
    s.addNotes(T(
      "The 41 tables fall into five groups: people and their settings, activities with participation, waiting lists, check-in and ratings, groups and private messaging, support and notifications, and admin and safety records such as the audit log. Views like my_profile expose only what each user is allowed to see.",
      "Ke-41 tabel terbagi dalam lima kelompok: pengguna dan pengaturannya, aktivitas beserta peserta, daftar tunggu, check-in, dan penilaian, grup dan pesan pribadi, bantuan dan notifikasi, serta catatan admin dan keamanan seperti log audit. View seperti my_profile hanya menampilkan data yang boleh dilihat tiap pengguna."));
  }

  // 19. Security & privacy
  {
    const s = content(pres, 19, T("Security & privacy", "Keamanan & privasi"), T("Rules enforced in the database, not just the screens", "Aturan ditegakkan di database, bukan hanya di layar"));
    const pts = [
      [fa.FaLock, T("Row-level security everywhere", "Row-level security di semua tabel"), T("All 41 tables have RLS. 190+ SQL functions check roles before acting.", "Ke-41 tabel memakai RLS. 190+ fungsi SQL mengecek peran sebelum bertindak.")],
      [fa.FaEyeSlash, T("Location privacy", "Privasi lokasi"), T("Live GPS is used per request and never stored. Profiles keep only an area's centre.", "GPS dipakai per permintaan dan tidak disimpan. Profil hanya menyimpan titik tengah wilayah.")],
      [fa.FaKey, T("PIN sign-in", "Masuk dengan PIN"), T("bcrypt-hashed, 15-minute lockout after failed tries, and throttling per network.", "Di-hash dengan bcrypt, dikunci 15 menit setelah gagal berulang, dan dibatasi per jaringan.")],
      [fa.FaIdCard, T("Private profile data", "Data profil pribadi"), T("Full name, WhatsApp, age and exact area can't be read by other members.", "Nama lengkap, WhatsApp, usia, dan wilayah persis tidak bisa dibaca anggota lain.")],
      [fa.FaHistory, T("Audit trail", "Jejak audit"), T("Every admin change goes into an append-only audit log; security events are recorded.", "Setiap perubahan oleh admin masuk ke log audit yang tidak bisa diubah; kejadian keamanan dicatat.")],
      [fa.FaFlag, T("Community safety", "Keamanan komunitas"), T("Report comments and messages, block users, and file complaints to staff.", "Laporkan komentar dan pesan, blokir pengguna, dan kirim keluhan ke staf.")],
    ];
    for (let i = 0; i < pts.length; i++) {
      const col = i % 2, r = Math.floor(i / 2);
      const x = 0.7 + col * 6.1, y = 2.0 + r * 1.5;
      await iconTile(pres, s, pts[i][0], x, y, 0.8, C.warm, C.deep);
      text(s, pts[i][1], { x: x + 1.05, y: y - 0.02, w: 4.8, h: 0.4, fontSize: 17, bold: true, color: C.ink });
      text(s, pts[i][2], { x: x + 1.05, y: y + 0.4, w: 4.8, h: 0.8, fontSize: 13, color: C.muted, valign: "top" });
    }
    s.addNotes(T(
      "Security is enforced in the database. Every table has row-level security, and over 190 SQL functions check the caller's role. GPS is never stored. PINs are hashed with bcrypt and lock after repeated failures. Other members can't read private profile fields. Admin actions are written to an audit log, and members can report, block and file complaints.",
      "Keamanan ditegakkan di database. Setiap tabel memakai row-level security, dan lebih dari 190 fungsi SQL mengecek peran pemanggilnya. GPS tidak pernah disimpan. PIN di-hash dengan bcrypt dan dikunci setelah gagal berulang kali. Anggota lain tidak bisa membaca data profil pribadi. Tindakan admin dicatat di log audit, dan anggota bisa melapor, memblokir, dan mengirim keluhan."));
  }

  // 20. Section: Results
  sectionSlide(pres, grad, "05", T("End results", "Hasil akhir"), T("What we delivered, and what's next", "Apa yang kami hasilkan, dan langkah berikutnya"))
    .addNotes(T("Part five: the results.", "Bagian kelima: hasilnya."));

  // 21. By the numbers
  {
    const s = content(pres, 21, T("End results", "Hasil akhir"), T("What we delivered", "Yang kami hasilkan"));
    const stats = [
      ["52", T("screens", "layar"), T("Member app, admin and sign-in", "Aplikasi anggota, admin, dan masuk")],
      ["74", T("UI components", "komponen UI"), T("Shared building blocks", "Blok penyusun yang dipakai bersama")],
      [T("25.6k", "25,6 rb"), T("lines of TypeScript", "baris TypeScript"), T("Across 194 source files, 43 unit tests", "Di 194 file sumber, 43 unit test")],
      [T("5.9k", "5,9 rb"), T("lines of SQL", "baris SQL"), T("Schema plus 26 migrations", "Skema plus 26 migrasi")],
      ["41", T("database tables", "tabel database"), T("All with row-level security", "Semua dengan row-level security")],
      [T("1,700+", "1.700+"), T("strings × 2 languages", "teks × 2 bahasa"), T("English and Bahasa Indonesia", "Bahasa Inggris dan Indonesia")],
    ];
    const cw = 3.85, ch = 1.95, gx = 0.175, gy = 0.25;
    for (let i = 0; i < stats.length; i++) {
      const x = 0.7 + (i % 3) * (cw + gx), y = 1.95 + Math.floor(i / 3) * (ch + gy);
      card(pres, s, x, y, cw, ch);
      text(s, stats[i][0], { x: x + 0.3, y: y + 0.25, w: cw - 0.6, h: 0.85, fontSize: 44, bold: true, color: C.orange, valign: "middle" });
      text(s, stats[i][1], { x: x + 0.3, y: y + 1.1, w: cw - 0.6, h: 0.38, fontSize: 16, bold: true, color: C.ink });
      text(s, stats[i][2], { x: x + 0.3, y: y + 1.48, w: cw - 0.6, h: 0.35, fontSize: 12.5, color: C.muted });
    }
    s.addNotes(T(
      "By the numbers: 52 screens, 74 shared components, about 25,600 lines of TypeScript with 43 unit tests, 5,900 lines of SQL across 26 migrations, 41 database tables all protected by row-level security, and more than 1,700 interface strings in both English and Indonesian.",
      "Dalam angka: 52 layar, 74 komponen, sekitar 25.600 baris TypeScript dengan 43 unit test, 5.900 baris SQL dalam 26 migrasi, 41 tabel database yang semuanya dilindungi row-level security, dan lebih dari 1.700 teks antarmuka dalam bahasa Inggris dan Indonesia."));
  }

  // 22. Latest improvements
  {
    const s = content(pres, 22, T("End results · latest", "Hasil akhir · terbaru"), T("Newest features", "Fitur terbaru"));
    const items = [
      [fa.FaUserClock, T("Waiting list & alerts", "Daftar tunggu & peringatan"), T(
        "Full activities keep a waiting list that moves up by itself. Alerts for new activities in your hobbies and groups.",
        "Aktivitas penuh punya daftar tunggu yang maju sendiri. Peringatan untuk aktivitas baru sesuai hobi dan grupmu.")],
      [fa.FaQrcode, T("Check-in & ratings", "Check-in & penilaian"), T(
        "Organizers show a QR code at the venue; people who came rate the activity, which builds the organizer's score.",
        "Penyelenggara menampilkan kode QR di lokasi; yang datang menilai aktivitasnya, membentuk skor penyelenggara.")],
      [fa.FaBell, T("Reminders & push", "Pengingat & push"), T(
        "A reminder the day before and a \"How was it?\" prompt after, by email and phone notification.",
        "Pengingat sehari sebelumnya dan pertanyaan \"Bagaimana acaranya?\" sesudahnya, lewat email dan notifikasi ponsel.")],
      [fa.FaTools, T("Organizer tools", "Alat penyelenggara"), T(
        "Duplicate, edit a weekly series at once, export to CSV, a big-screen QR, friends going and a calendar feed.",
        "Duplikat, ubah seri mingguan sekaligus, ekspor CSV, QR layar besar, teman yang ikut, dan feed kalender.")],
    ];
    for (let i = 0; i < items.length; i++) {
      const y = 1.95 + i * 1.15;
      card(pres, s, 0.7, y, 7.6, 1.0);
      await iconTile(pres, s, items[i][0], 0.9, y + 0.17, 0.66);
      text(s, items[i][1], { x: 1.8, y: y + 0.12, w: 6.3, h: 0.35, fontSize: 15.5, bold: true, color: C.ink });
      text(s, items[i][2], { x: 1.8, y: y + 0.47, w: 6.3, h: 0.48, fontSize: 12, color: C.muted, valign: "top" });
    }
    card(pres, s, 8.75, 1.95, 3.85, 4.45, C.white);
    s.addImage({ data: qr, x: 9.3, y: 2.35, w: 2.75, h: 2.75 });
    text(s, T("Try it now", "Coba sekarang"), { x: 8.75, y: 5.3, w: 3.85, h: 0.4, fontSize: 17, bold: true, color: C.ink, align: "center" });
    text(s, "komunitasa.vercel.app", { x: 8.75, y: 5.7, w: 3.85, h: 0.35, fontSize: 13, color: C.deep, align: "center" });
    s.addNotes(T(
      "The newest features: full activities keep a waiting list that moves up automatically, and people get alerts for new activities that match their hobbies. Organizers can check people in with a QR code, and attendees rate the activity afterwards. Reminders and rating prompts go out by email and phone push. And organizers get time-savers: duplicate, edit a whole weekly series, CSV export and a big-screen QR so a room can join live. Scan this code to try it now.",
      "Fitur terbaru: aktivitas yang penuh punya daftar tunggu yang maju otomatis, dan pengguna mendapat peringatan untuk aktivitas baru yang sesuai hobinya. Penyelenggara bisa mencatat kehadiran dengan kode QR, dan peserta menilai aktivitasnya setelah selesai. Pengingat dan permintaan penilaian dikirim lewat email dan push di ponsel. Penyelenggara juga mendapat alat praktis: duplikat, ubah seluruh seri mingguan, ekspor CSV, dan QR layar besar agar seisi ruangan bisa ikut langsung. Pindai kode ini untuk mencoba sekarang."));
  }

  // 23. Known gaps & next steps
  {
    const s = content(pres, 23, T("What's next", "Langkah berikutnya"), T("Known gaps and next steps", "Kekurangan yang diketahui dan rencana ke depan"));
    const gaps = [
      [T("Stronger second factor", "Faktor kedua lebih kuat"), T("Move the email-code step into a server-side login endpoint, or use Supabase MFA.", "Pindahkan langkah kode email ke endpoint login di server, atau pakai MFA Supabase.")],
      [T("Scheduled reports", "Laporan terjadwal"), T("The scheduler now runs reminders; weekly admin emails can build on it.", "Penjadwal sudah menjalankan pengingat; email admin mingguan bisa dibangun di atasnya.")],
      [T("Payments", "Pembayaran"), T("Paid activities are settled outside the app today; in-app payment comes later.", "Aktivitas berbayar saat ini dibayar di luar aplikasi; pembayaran di aplikasi menyusul.")],
      [T("Full account deletion", "Hapus akun sepenuhnya"), T("Anonymizing works today; removing the login needs a server-side step.", "Anonimisasi sudah jalan; menghapus login butuh langkah di sisi server.")],
      [T("Big exports", "Ekspor besar"), T("Exports run in the browser and cap at 10,000 rows per dataset.", "Ekspor berjalan di browser dan dibatasi 10.000 baris per dataset.")],
      [T("Group chat & photos", "Chat grup & foto"), T("A chat per activity and shared photo albums after it.", "Chat per aktivitas dan album foto bersama setelahnya.")],
    ];
    for (let i = 0; i < gaps.length; i++) {
      const col = i % 2, r = Math.floor(i / 2);
      const x = 0.7 + col * 6.1, y = 2.0 + r * 1.45;
      card(pres, s, x, y, 5.8, 1.25);
      text(s, String(i + 1), { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.75, fontSize: 30, bold: true, color: C.peach, valign: "middle" });
      text(s, gaps[i][0], { x: x + 0.9, y: y + 0.2, w: 4.7, h: 0.38, fontSize: 16, bold: true, color: C.ink });
      text(s, gaps[i][1], { x: x + 0.9, y: y + 0.58, w: 4.7, h: 0.6, fontSize: 12.5, color: C.muted, valign: "top" });
    }
    s.addNotes(T(
      "We're open about what's left: a stronger second sign-in factor, scheduled admin reports, in-app payments, full account deletion, larger exports, and a group chat and photo albums per activity.",
      "Kami terbuka soal yang masih kurang: faktor masuk kedua yang lebih kuat, laporan admin terjadwal, pembayaran di aplikasi, penghapusan akun sepenuhnya, ekspor yang lebih besar, serta chat grup dan album foto per aktivitas."));
  }

  // 24. Closing
  {
    const s = pres.addSlide();
    s.background = { data: grad };
    s.addImage({ data: logoCream, x: (W - 1.2) / 2, y: 1.2, w: 1.2, h: 1.2 });
    text(s, T("Thank you", "Terima kasih"), { x: 0.7, y: 2.7, w: W - 1.4, h: 1.0, fontSize: 54, bold: true, color: C.cream, align: "center" });
    text(s, tagline, { x: 0.7, y: 3.7, w: W - 1.4, h: 0.6, fontSize: 22, color: C.peach, align: "center" });
    const pw = 5.2;
    pill(pres, s, (W - pw) / 2, 4.75, pw, 0.75, C.cream);
    text(s, "komunitasa.vercel.app", { x: (W - pw) / 2, y: 4.75, w: pw, h: 0.75, fontSize: 24, bold: true, color: C.deep, align: "center", valign: "middle" });
    text(s, T("A Team · Capstone Project · Universitas Terbuka", "A Team · Proyek Capstone · Universitas Terbuka"), { x: 0.7, y: 6.3, w: W - 1.4, h: 0.4, fontSize: 15, bold: true, color: C.peach, align: "center" });
    s.addNotes(T(
      "Thank you from A Team. We're happy to take questions, and please try Komunitas on your phone.",
      "Terima kasih dari A Team. Kami senang menjawab pertanyaan, dan silakan coba Komunitas di ponsel kalian."));
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
