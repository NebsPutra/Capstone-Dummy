// Builds ../komunitas-project-deck.pptx: the full project story (aim, how to use,
// how it's built, data stores, results), 16:9 with speaker notes, Orange/Cream branding.
// Usage: cd flyer/scripts && npm install && node build-project-deck.js
const path = require("path");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const QRCode = require("qrcode");
const fa = require("react-icons/fa");

const OUT = path.join(__dirname, "..", "komunitas-project-deck.pptx");
const LOGO = path.join(__dirname, "..", "a-team-logo.png");
const LANDING = path.join(__dirname, "..", "deck-assets", "landing.png");

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
  text(slide, "Komunitas · Capstone Project · A Team", { x: 1.1, y: 6.87, w: 6, h: 0.3, fontSize: 11, color: C.muted, valign: "middle" });
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
  pres.title = "Komunitas: Project Overview";
  pres.author = "A Team";

  const grad = await gradient(1920, 1080);
  const logoCream = await png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="13" fill="#FFF8ED"/><path d="M12.5 37.5 24 11.5l11.5 26" fill="none" stroke="#EA580C" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.6 28.4Q24 34 30.4 28.4" fill="none" stroke="#EA580C" stroke-width="3.4" stroke-linecap="round"/></svg>`, 512);
  const qrSvg = await QRCode.toString("https://komunitasa.vercel.app", { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#292524", light: "#FFFFFF" } });
  const qr = await png(qrSvg, 800);

  // 1. Title
  {
    const s = pres.addSlide();
    s.background = { data: grad };
    s.addImage({ data: logoCream, x: 0.8, y: 0.8, w: 1.0, h: 1.0 });
    text(s, "CAPSTONE PROJECT · A TEAM", { x: 0.8, y: 2.35, w: 10, h: 0.5, fontSize: 18, bold: true, color: C.peach, charSpacing: 5 });
    text(s, "Komunitas", { x: 0.8, y: 2.8, w: 11, h: 1.5, fontSize: 88, bold: true, color: C.cream });
    text(s, "Find activities. Meet people. Build community.", { x: 0.8, y: 4.35, w: 11, h: 0.6, fontSize: 26, color: C.cream });
    text(s, "The whole project: aim, how to use it, how it's built, where data lives, and what we delivered.", { x: 0.8, y: 5.0, w: 10.5, h: 0.5, fontSize: 16, color: C.peach });
    text(s, "komunitasa.vercel.app   ·   Universitas Terbuka   ·   September 2026", { x: 0.8, y: 6.45, w: 11, h: 0.4, fontSize: 15, bold: true, color: C.peach });
    s.addNotes("Welcome. We're A Team, and this is Komunitas, our capstone project. This deck covers the whole project from the bottom up: why we built it, how people use it, how it's built, where the data is stored, and what we ended up delivering.");
  }

  // 2. Agenda
  {
    const s = content(pres, 2, "Agenda", "What this deck covers");
    const items = [
      ["01", "Aim & goals", "The problem and what we set out to do"],
      ["02", "How to use it", "Participants, organizers and admins"],
      ["03", "How it's built", "Architecture, stack and delivery pipeline"],
      ["04", "Data stores", "Where every piece of data lives, and how it's protected"],
      ["05", "End results", "What we shipped, by the numbers, and what's next"],
    ];
    for (let i = 0; i < items.length; i++) {
      const y = 1.95 + i * 0.93;
      card(pres, s, 0.7, y, 11.9, 0.78);
      text(s, items[i][0], { x: 1.0, y, w: 0.9, h: 0.78, fontSize: 24, bold: true, color: C.orange, valign: "middle" });
      text(s, items[i][1], { x: 2.0, y, w: 3.8, h: 0.78, fontSize: 20, bold: true, color: C.ink, valign: "middle" });
      text(s, items[i][2], { x: 5.9, y, w: 6.5, h: 0.78, fontSize: 15, color: C.muted, valign: "middle" });
    }
    s.addNotes("Five parts: aim and goals, how to use the app, how it's built, where the data lives, and the end results.");
  }

  // 3. Section: Aim
  sectionSlide(pres, grad, "01", "Aim & goals", "Why Komunitas exists").addNotes("Part one: why we built Komunitas.");

  // 4. Problem & aim
  {
    const s = content(pres, 4, "The problem", "Local activities are hard to find and hard to run");
    const probs = [
      [fa.FaSearch, "Scattered", "Runs, book clubs and games are announced in private WhatsApp groups and social posts. If you're not in the group, you never hear about them."],
      [fa.FaUserFriends, "Hard to join", "Newcomers don't know who to ask, whether there's room, or whether it's even open to them."],
      [fa.FaClipboardCheck, "Manual work", "Organizers track sign-ups, capacity and contact numbers by hand, in chats and spreadsheets."],
    ];
    for (let i = 0; i < probs.length; i++) {
      const y = 2.0 + i * 1.5;
      await iconTile(pres, s, probs[i][0], 0.7, y, 0.8, C.warm, C.deep);
      text(s, probs[i][1], { x: 1.75, y: y - 0.02, w: 5.2, h: 0.4, fontSize: 19, bold: true, color: C.ink });
      text(s, probs[i][2], { x: 1.75, y: y + 0.42, w: 5.2, h: 0.95, fontSize: 14, color: C.muted, valign: "top" });
    }
    card(pres, s, 7.5, 2.0, 5.1, 4.4, C.white);
    await iconTile(pres, s, fa.FaBullseye, 7.9, 2.4, 0.8);
    text(s, "OUR AIM", { x: 7.9, y: 3.45, w: 4.3, h: 0.35, fontSize: 13, bold: true, color: C.deep, charSpacing: 3 });
    text(s, "One place to discover, create and join social activities near you, based on your interests and location, while keeping your exact location private.", { x: 7.9, y: 3.85, w: 4.3, h: 2.3, fontSize: 19, bold: true, color: C.ink, valign: "top", lineSpacingMultiple: 1.1 });
    s.addNotes("Today, local activities live in closed WhatsApp groups and scattered posts. Newcomers can't find them, and organizers do everything by hand. Our aim is one place to discover, create and join activities nearby, based on your interests and location, without ever storing your exact position.");
  }

  // 5. Goals
  {
    const s = content(pres, 5, "Goals", "Five goals the product had to meet");
    const goals = [
      ["20 km", "Nearby first", "The dashboard shows open activities within 20 km of you, matched to your hobbies."],
      ["1 tap", "Easy to join", "Join open activities instantly, or request a spot when the organizer approves joiners."],
      ["4 ways", "Easy to share", "Invite link, WhatsApp, QR code and a ready-made flyer for every activity."],
      ["0", "GPS stored", "Your live location is used in the moment only and never saved to the database."],
      ["EN · ID", "Bilingual", "Every screen in English and Bahasa Indonesia, switchable at any time."],
    ];
    const cw = 2.2, gap = 0.225, y = 2.05, ch = 3.7;
    for (let i = 0; i < goals.length; i++) {
      const x = 0.7 + i * (cw + gap);
      card(pres, s, x, y, cw, ch);
      text(s, goals[i][0], { x: x + 0.25, y: y + 0.35, w: cw - 0.5, h: 0.95, fontSize: goals[i][0].length > 5 ? 30 : 40, bold: true, color: C.orange, valign: "middle" });
      text(s, goals[i][1], { x: x + 0.25, y: y + 1.45, w: cw - 0.5, h: 0.5, fontSize: 18, bold: true, color: C.ink });
      text(s, goals[i][2], { x: x + 0.25, y: y + 2.0, w: cw - 0.5, h: 1.55, fontSize: 14, color: C.muted, valign: "top" });
    }
    s.addNotes("We turned the aim into five concrete goals: nearby-first discovery within 20 kilometres, joining in one tap, four ways to share, zero stored GPS positions, and full English and Indonesian support.");
  }

  // 6. Section: How to use
  sectionSlide(pres, grad, "02", "How to use it", "For participants, organizers and admins").addNotes("Part two: how people actually use Komunitas.");

  // 7. Meet the app (screenshot)
  {
    const s = content(pres, 7, "Meet the app", "A mobile-first web app, no install needed");
    card(pres, s, 0.7, 1.95, 7.4, 4.65, C.ink);
    s.addImage({ path: LANDING, x: 0.85, y: 2.1, w: 7.1, h: 4.4375, rounding: false });
    const pts = [
      [fa.FaMobileAlt, "Works in any browser", "Phone first, with a bottom nav on mobile and a sidebar on desktop."],
      [fa.FaPalette, "Light, dark or system", "Warm orange and cream design, Plus Jakarta Sans."],
      [fa.FaLanguage, "English / Indonesian", "Switch language from the header on any page."],
      [fa.FaGlobe, "Always up to date", "Live at komunitasa.vercel.app, updated on every release."],
    ];
    for (let i = 0; i < pts.length; i++) {
      const y = 2.0 + i * 1.15;
      await iconTile(pres, s, pts[i][0], 8.5, y, 0.7);
      text(s, pts[i][1], { x: 9.4, y: y - 0.03, w: 3.3, h: 0.38, fontSize: 16, bold: true, color: C.ink });
      text(s, pts[i][2], { x: 9.4, y: y + 0.35, w: 3.3, h: 0.7, fontSize: 12.5, color: C.muted, valign: "top" });
    }
    s.addNotes("This is the live landing page. Komunitas is a web app, so there's nothing to install. It's designed for phones first, has light and dark themes, and every screen is available in English and Indonesian.");
  }

  // 8. Roles
  {
    const s = content(pres, 8, "Who uses it", "Five roles, each with clear permissions");
    const roles = [
      [fa.FaUserCircle, "Participant", "Discovers, joins, comments and messages. Every new member starts here."],
      [fa.FaUserTie, "Organizer", "Any participant who creates an activity: edits it, approves joiners, shares it, makes flyers."],
      [fa.FaUserShield, "Moderator", "Handles complaints and reported comments or messages."],
      [fa.FaUserCog, "Admin", "Also manages users, events, categories, settings and data exports."],
      [fa.FaCrown, "Super admin", "Also changes roles and anonymizes users. Every admin action is audited."],
    ];
    const cw = 2.2, gap = 0.225, y = 2.05, ch = 4.3;
    for (let i = 0; i < roles.length; i++) {
      const x = 0.7 + i * (cw + gap);
      card(pres, s, x, y, cw, ch, i === 1 ? C.warm : C.white);
      await iconTile(pres, s, roles[i][0], x + 0.3, y + 0.35, 0.8, i === 1 ? C.deep : C.orange);
      text(s, roles[i][1], { x: x + 0.3, y: y + 1.4, w: cw - 0.6, h: 0.5, fontSize: 18, bold: true, color: C.ink });
      text(s, roles[i][2], { x: x + 0.3, y: y + 1.95, w: cw - 0.6, h: 2.2, fontSize: 13.5, color: C.muted, valign: "top" });
    }
    s.addNotes("There are five roles. Participants and organizers are the same people: anyone who creates an activity becomes its organizer. Moderators, admins and super admins work in the admin area, with more power at each level. Permissions are enforced in the database, not only in the screens.");
  }

  // 9. Participant journey
  {
    const s = content(pres, 9, "How to use · participants", "From sign-up to showing up in five steps");
    const steps = [
      [fa.FaUserPlus, "Sign up", "Email, password and a 6-digit code sent by email. Then set a 6-digit PIN for quick sign-in."],
      [fa.FaHeart, "Pick hobbies", "Choose interests such as running, reading, cycling, badminton or basketball."],
      [fa.FaMapMarkerAlt, "Find nearby", "Use live GPS or pick your area. The dashboard lists activities within 20 km."],
      [fa.FaHandshake, "Join", "Join in one tap, or request a spot. Get notified when you're approved."],
      [fa.FaComments, "Meet up", "Ask questions in comments, message people privately, and add friends."],
    ];
    const cw = 2.15, gap = 0.3, y = 2.1, ch = 3.75;
    for (let i = 0; i < steps.length; i++) {
      const x = 0.7 + i * (cw + gap);
      card(pres, s, x, y, cw, ch);
      await iconTile(pres, s, steps[i][0], x + 0.3, y + 0.35, 0.75);
      text(s, String(i + 1).padStart(2, "0"), { x: x + 1.2, y: y + 0.35, w: 0.8, h: 0.75, fontSize: 20, bold: true, color: C.deep, valign: "middle" });
      text(s, steps[i][1], { x: x + 0.3, y: y + 1.35, w: cw - 0.6, h: 0.45, fontSize: 18, bold: true, color: C.ink });
      text(s, steps[i][2], { x: x + 0.3, y: y + 1.9, w: cw - 0.6, h: 1.75, fontSize: 13, color: C.muted, valign: "top" });
      if (i < steps.length - 1) await arrow(s, x + cw + 0.04, y + ch / 2 - 0.11);
    }
    s.addNotes("A participant signs up with email, a password and an emailed code, then sets a PIN for quick sign-in. They choose hobbies, then share their location or pick their area to see activities within 20 kilometres. They join in one tap or request a spot, and then use comments, private messages and friends to connect.");
  }

  // 10. Organizer journey
  {
    const s = content(pres, 10, "How to use · organizers", "Create, share and run an activity");
    const steps = [
      [fa.FaPlusCircle, "Create", "Title, category, date and time, fee, capacity, and a pin on the map. Upload and crop a banner."],
      [fa.FaLock, "Set the rules", "Public or private. Open joining, or approval required. Add a contact person and WhatsApp."],
      [fa.FaShareAlt, "Share", "Invite link, WhatsApp, QR code, or a flyer in 9:16, 1:1 or 16:9 as PNG or JPG."],
      [fa.FaClipboardCheck, "Manage", "Approve or decline requests, answer comments, edit details, or cancel."],
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
    // Status lifecycle
    text(s, "The status updates itself as people join and time passes:", { x: 0.7, y: 5.5, w: 7, h: 0.35, fontSize: 13, bold: true, color: C.body });
    const st = [["Open", C.green], ["Almost full", C.orange], ["Full", C.deep], ["Ongoing", "2563EB"], ["Completed", C.muted]];
    let px = 0.7;
    for (let i = 0; i < st.length; i++) {
      const w = 0.55 + st[i][0].length * 0.1;
      pill(pres, s, px, 5.95, w, 0.45, C.white);
      s.addShape(pres.shapes.OVAL, { x: px + 0.17, y: 6.105, w: 0.14, h: 0.14, fill: { color: st[i][1] }, line: { type: "none" } });
      text(s, st[i][0], { x: px + 0.38, y: 5.95, w: w - 0.45, h: 0.45, fontSize: 12.5, bold: true, color: C.ink, valign: "middle" });
      px += w + 0.12;
      if (i < st.length - 1) { await arrow(s, px - 0.02, 6.07, 0.2); px += 0.3; }
    }
    text(s, "(or Cancelled)", { x: px + 0.1, y: 5.95, w: 1.6, h: 0.45, fontSize: 12.5, color: C.muted, valign: "middle" });
    s.addNotes("Organizers fill in the activity details, drop a pin on the map and crop a banner. They choose whether it's public or private and whether joiners need approval. Then they share it by link, WhatsApp, QR code or a generated flyer, and manage requests and comments. The status moves from open to almost full, full, ongoing and completed by itself.");
  }

  // 11. Features map
  {
    const s = content(pres, 11, "Everything in the app", "Feature map");
    const f = [
      [fa.FaCompass, "Nearby dashboard", "Activities within 20 km, matched to your hobbies"],
      [fa.FaSearch, "Explore & search", "Any distance; search by name, place or event code"],
      [fa.FaCalendarAlt, "My activities", "What you organize and what you've joined"],
      [fa.FaQrcode, "Share & invite", "Link, WhatsApp, QR code and flyer generator"],
      [fa.FaComments, "Comments", "Questions and replies on each activity, with reporting"],
      [fa.FaEnvelopeOpenText, "Private messages", "Realtime 1:1 chat, mute, archive and block"],
      [fa.FaUserFriends, "Community", "Public profiles, usernames, friends, social links"],
      [fa.FaBell, "Notifications", "Approvals, replies and updates, with preferences"],
      [fa.FaLifeRing, "Help & support", "Complaint tickets with attachments, emailed to admins"],
    ];
    const cw = 3.85, ch = 1.3, gx = 0.175, gy = 0.2;
    for (let i = 0; i < f.length; i++) {
      const x = 0.7 + (i % 3) * (cw + gx), y = 1.95 + Math.floor(i / 3) * (ch + gy);
      card(pres, s, x, y, cw, ch);
      await iconTile(pres, s, f[i][0], x + 0.25, y + 0.28, 0.72, C.warm, C.deep);
      text(s, f[i][1], { x: x + 1.15, y: y + 0.22, w: cw - 1.35, h: 0.4, fontSize: 16, bold: true, color: C.ink });
      text(s, f[i][2], { x: x + 1.15, y: y + 0.6, w: cw - 1.35, h: 0.6, fontSize: 12.5, color: C.muted, valign: "top" });
    }
    s.addNotes("Here's everything in the app on one slide: the nearby dashboard, explore and search, my activities, sharing, comments, private messages, community profiles and friends, notifications, and help and support tickets.");
  }

  // 12. Section: How it's built
  sectionSlide(pres, grad, "03", "How it's built", "Architecture, stack and delivery").addNotes("Part three: how it's built.");

  // 13. Architecture
  {
    const s = content(pres, 13, "Architecture", "Three layers, with security in the database");
    const box = async (x, y, w, h, Comp, title, lines, fill = C.white) => {
      card(pres, s, x, y, w, h, fill);
      await iconTile(pres, s, Comp, x + 0.25, y + 0.25, 0.6);
      text(s, title, { x: x + 1.0, y: y + 0.25, w: w - 1.2, h: 0.6, fontSize: 16, bold: true, color: C.ink, valign: "middle" });
      text(s, lines.map((t, i) => ({ text: t, options: { bullet: true, breakLine: i < lines.length - 1 } })), { x: x + 0.25, y: y + 1.0, w: w - 0.45, h: h - 1.15, fontSize: 12.5, color: C.body, valign: "top", paraSpaceAfter: 4 });
    };
    await box(0.7, 2.0, 3.4, 3.2, fa.FaMobileAlt, "Browser", ["React 19 pages and forms", "Live GPS read on the device", "Leaflet maps (OpenStreetMap)", "Flyer and chart images drawn here"]);
    await box(4.95, 2.0, 3.4, 3.2, fa.FaServer, "Vercel · Next.js 16", ["Server-rendered pages (App Router)", "5 API routes: PIN sign-in, PIN recovery, alert emails", "Login check on every request", "Secrets kept server-side"]);
    await box(9.2, 2.0, 3.4, 3.2, fa.FaDatabase, "Supabase", ["Postgres + row-level security", "Auth: accounts, sessions, email codes", "Storage: banners, attachments", "Realtime: live messages"]);
    const conn = (x1, x2, y, label) => {
      s.addShape(pres.shapes.LINE, { x: x1, y, w: x2 - x1, h: 0, line: { color: C.orange, width: 2, beginArrowType: "triangle", endArrowType: "triangle" } });
      text(s, label, { x: x1 - 0.2, y: y - 0.38, w: x2 - x1 + 0.4, h: 0.3, fontSize: 10.5, color: C.muted, align: "center" });
    };
    conn(4.15, 4.9, 3.6, "HTTPS");
    conn(8.4, 9.15, 3.6, "SQL · RPC");
    // External services row
    const ext = [
      [fa.FaMap, "OpenStreetMap", "Map tiles and area lookup"],
      [fa.FaEnvelope, "SMTP email", "Sign-in codes, complaint alerts"],
      [fa.FaGithub, "GitHub", "Code, history, triggers deploys"],
    ];
    for (let i = 0; i < ext.length; i++) {
      const x = 0.7 + i * 4.25;
      pill(pres, s, x, 5.55, 3.4, 0.85, C.white);
      await iconTile(pres, s, ext[i][0], x + 0.15, 5.66, 0.63, C.warm, C.deep);
      text(s, ext[i][1], { x: x + 0.95, y: 5.62, w: 2.35, h: 0.35, fontSize: 12.5, bold: true, color: C.ink });
      text(s, ext[i][2], { x: x + 0.95, y: 5.95, w: 2.35, h: 0.35, fontSize: 11, color: C.muted });
    }
    s.addNotes("The app has three layers. The browser runs the React interface, reads GPS on the device and draws maps and images. Vercel runs Next.js: it renders pages on the server, checks the login on every request, and hosts five small API routes. Supabase holds the database, sign-in, file storage and realtime messaging. Around it we use OpenStreetMap for maps, an SMTP service for emails, and GitHub for the code.");
  }

  // 14. Tech stack
  {
    const s = content(pres, 14, "Tech stack", "Modern, free-tier friendly tools");
    const rows = [
      [fa.FaReact, "Next.js 16 · React 19 · TypeScript", "App Router, server components; one typed codebase for pages and API routes."],
      [fa.FaPalette, "Tailwind CSS 3", "Design tokens for the Orange/Cream palette, light and dark themes."],
      [fa.FaDatabase, "Supabase", "Postgres, Auth, Storage, Realtime. Rules live in SQL: RLS and security-definer functions."],
      [fa.FaMap, "Leaflet + OpenStreetMap", "Maps and place lookup with no API key and no cost."],
      [fa.FaChartBar, "Recharts · ExcelJS · docx", "Admin charts, and Excel and Word exports built in the browser."],
      [fa.FaQrcode, "qrcode.react · html-to-image", "QR codes, and PNG/JPG export for charts and flyers."],
    ];
    for (let i = 0; i < rows.length; i++) {
      const col = i % 2, r = Math.floor(i / 2);
      const x = 0.7 + col * 6.1, y = 2.0 + r * 1.5;
      card(pres, s, x, y, 5.8, 1.3);
      await iconTile(pres, s, rows[i][0], x + 0.25, y + 0.28, 0.74);
      text(s, rows[i][1], { x: x + 1.2, y: y + 0.2, w: 4.4, h: 0.4, fontSize: 15.5, bold: true, color: C.ink });
      text(s, rows[i][2], { x: x + 1.2, y: y + 0.6, w: 4.4, h: 0.6, fontSize: 12.5, color: C.muted, valign: "top" });
    }
    s.addNotes("The stack: Next.js 16 with React 19 and TypeScript, Tailwind for styling, Supabase for the backend, Leaflet and OpenStreetMap for maps, Recharts and ExcelJS for admin reports, and qrcode.react plus html-to-image for QR codes and flyers.");
  }

  // 15. Delivery pipeline
  {
    const s = content(pres, 15, "How we build & ship", "Every change is checked before it goes live");
    const steps = [
      [fa.FaTerminal, "Code locally", "npm run dev at localhost:3000"],
      [fa.FaCheckDouble, "Check", "Lint (0 errors), type check, production build"],
      [fa.FaCodeBranch, "Push to main", "GitHub: NebsPutra/Capstone-Dummy"],
      [fa.FaRocket, "Auto-deploy", "Vercel builds and publishes in about a minute"],
      [fa.FaGlobe, "Live", "Everyone gets the new version"],
    ];
    const cw = 2.15, gap = 0.3, y = 2.0, ch = 2.35;
    for (let i = 0; i < steps.length; i++) {
      const x = 0.7 + i * (cw + gap);
      card(pres, s, x, y, cw, ch, i === 4 ? C.warm : C.white);
      await iconTile(pres, s, steps[i][0], x + 0.3, y + 0.3, 0.68);
      text(s, steps[i][1], { x: x + 0.3, y: y + 1.12, w: cw - 0.5, h: 0.4, fontSize: 16, bold: true, color: C.ink });
      text(s, steps[i][2], { x: x + 0.3, y: y + 1.52, w: cw - 0.5, h: 0.75, fontSize: 12, color: C.muted, valign: "top" });
      if (i < steps.length - 1) await arrow(s, x + cw + 0.04, y + ch / 2 - 0.11);
    }
    card(pres, s, 0.7, 4.7, 11.9, 1.85);
    await iconTile(pres, s, fa.FaDatabase, 1.0, 5.0, 0.72, C.warm, C.deep);
    text(s, "Database changes follow their own path", { x: 1.95, y: 4.95, w: 10.3, h: 0.4, fontSize: 16, bold: true, color: C.ink });
    text(s, "Each change is a numbered SQL file (schema.sql, then migrations 002 to 010). Every file is safe to run twice, and a team member runs it by hand, in order, in the Supabase SQL Editor. Secrets live only in Vercel and on the developer's machine, never in GitHub.", { x: 1.95, y: 5.38, w: 10.3, h: 1.0, fontSize: 13, color: C.muted, valign: "top" });
    s.addNotes("We code locally, then run three checks: lint, type check and a full production build. Pushing to the main branch on GitHub makes Vercel build and publish automatically, so a push is a release. Database changes are separate: numbered SQL migrations, each safe to re-run, applied by hand in the Supabase SQL editor.");
  }

  // 16. Section: Data
  sectionSlide(pres, grad, "04", "Data stores", "Where data lives and how it's protected").addNotes("Part four: the data.");

  // 17. Data stores overview
  {
    const s = content(pres, 17, "Data stores", "Five places data lives");
    const stores = [
      [fa.FaDatabase, "Supabase Postgres", "31 tables · 2 views", "Profiles, activities, participants, comments, messages, complaints, notifications, audit log. Row-level security on every table.", C.warm],
      [fa.FaFingerprint, "Supabase Auth", "Accounts & sessions", "Email and password, 6-digit email codes, sessions. The sign-in PIN is stored separately, bcrypt-hashed.", C.white],
      [fa.FaHdd, "Supabase Storage", "2 file buckets", "event-banners (public images) and complaint-attachments (private, staff and reporter only).", C.white],
      [fa.FaCookieBite, "The user's device", "Cookie + local storage", "Language choice and the chosen area or GPS preference. Live GPS stays on the device.", C.white],
      [fa.FaKey, "Vercel environment", "Server secrets", "Service-role key and SMTP password. Server-only, never sent to browsers or committed.", C.white],
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
    s.addNotes("Data lives in five places. The main one is the Supabase Postgres database with 31 tables, all protected by row-level security. Supabase Auth holds accounts and sessions. Supabase Storage holds banner images and complaint attachments. The user's own device keeps their language and location preference; live GPS never leaves it. And Vercel holds the few server secrets.");
  }

  // 18. Data model
  {
    const s = content(pres, 18, "Data model", "31 tables in five groups");
    const groups = [
      [fa.FaIdCard, "People", ["profiles", "interests", "user_interests", "user_pins", "privacy_settings", "social_links", "friendships", "user_blocks", "username_history", "reserved_usernames"]],
      [fa.FaTicketAlt, "Activities", ["events", "categories", "event_participants", "event_comments", "comment_reports"]],
      [fa.FaComments, "Messaging", ["conversations", "conversation_members", "messages", "message_reports"]],
      [fa.FaLifeRing, "Support", ["complaints", "complaint_messages", "complaint_attachments", "complaint_status_history", "notifications", "notification_prefs"]],
      [fa.FaUserShield, "Admin & safety", ["audit_logs", "security_events", "admin_events", "platform_settings", "saved_views", "export_jobs"]],
    ];
    const cw = 2.2, gap = 0.225, y = 1.95, ch = 4.55;
    for (let i = 0; i < groups.length; i++) {
      const x = 0.7 + i * (cw + gap);
      card(pres, s, x, y, cw, ch);
      await iconTile(pres, s, groups[i][0], x + 0.25, y + 0.25, 0.6);
      text(s, groups[i][1], { x: x + 0.95, y: y + 0.25, w: cw - 1.05, h: 0.6, fontSize: 15, bold: true, color: C.ink, valign: "middle" });
      text(s, `${groups[i][2].length} tables`, { x: x + 0.25, y: y + 0.95, w: cw - 0.5, h: 0.3, fontSize: 11.5, bold: true, color: C.deep });
      text(s, groups[i][2].map((t, j) => ({ text: t, options: { breakLine: j < groups[i][2].length - 1 } })), { x: x + 0.25, y: y + 1.32, w: cw - 0.4, h: ch - 1.45, fontSize: 10.5, color: C.body, valign: "top", paraSpaceAfter: 3 });
    }
    s.addNotes("The 31 tables fall into five groups: people and their settings, activities and participation, private messaging, support and notifications, and admin and safety records such as the audit log. Views like my_profile expose only what each user is allowed to see.");
  }

  // 19. Security & privacy
  {
    const s = content(pres, 19, "Security & privacy", "Rules enforced in the database, not just the screens");
    const pts = [
      [fa.FaLock, "Row-level security everywhere", "All 31 tables have RLS. 150+ SQL functions check roles before acting."],
      [fa.FaEyeSlash, "Location privacy", "Live GPS is used per request and never stored. Profiles keep only an area's centre."],
      [fa.FaKey, "PIN sign-in", "bcrypt-hashed, 15-minute lockout after failed tries, and throttling per network."],
      [fa.FaIdCard, "Private profile data", "Full name, WhatsApp, age and exact area can't be read by other members."],
      [fa.FaHistory, "Audit trail", "Every admin change goes into an append-only audit log; security events are recorded."],
      [fa.FaFlag, "Community safety", "Report comments and messages, block users, and file complaints to staff."],
    ];
    for (let i = 0; i < pts.length; i++) {
      const col = i % 2, r = Math.floor(i / 2);
      const x = 0.7 + col * 6.1, y = 2.0 + r * 1.5;
      await iconTile(pres, s, pts[i][0], x, y, 0.8, C.warm, C.deep);
      text(s, pts[i][1], { x: x + 1.05, y: y - 0.02, w: 4.7, h: 0.4, fontSize: 17, bold: true, color: C.ink });
      text(s, pts[i][2], { x: x + 1.05, y: y + 0.4, w: 4.7, h: 0.8, fontSize: 13, color: C.muted, valign: "top" });
    }
    s.addNotes("Security is enforced in the database. Every table has row-level security, and over 150 SQL functions check the caller's role. GPS is never stored. PINs are hashed with bcrypt and lock after repeated failures. Other members can't read private profile fields. Admin actions are written to an audit log, and members can report, block and file complaints.");
  }

  // 20. Section: Results
  sectionSlide(pres, grad, "05", "End results", "What we delivered, and what's next").addNotes("Part five: the results.");

  // 21. By the numbers
  {
    const s = content(pres, 21, "End results", "What we delivered");
    const stats = [
      ["45", "screens", "Member app, admin area and sign-in flows"],
      ["51", "UI components", "Shared building blocks"],
      ["19.4k", "lines of TypeScript", "Across 140 source files"],
      ["4.6k", "lines of SQL", "Schema plus 9 migrations"],
      ["31", "database tables", "All with row-level security"],
      ["1,400+", "strings × 2 languages", "English and Bahasa Indonesia"],
    ];
    const cw = 3.85, ch = 1.95, gx = 0.175, gy = 0.25;
    for (let i = 0; i < stats.length; i++) {
      const x = 0.7 + (i % 3) * (cw + gx), y = 1.95 + Math.floor(i / 3) * (ch + gy);
      card(pres, s, x, y, cw, ch);
      text(s, stats[i][0], { x: x + 0.3, y: y + 0.25, w: cw - 0.6, h: 0.85, fontSize: 44, bold: true, color: C.orange, valign: "middle" });
      text(s, stats[i][1], { x: x + 0.3, y: y + 1.1, w: cw - 0.6, h: 0.38, fontSize: 16, bold: true, color: C.ink });
      text(s, stats[i][2], { x: x + 0.3, y: y + 1.48, w: cw - 0.6, h: 0.35, fontSize: 12.5, color: C.muted });
    }
    s.addNotes("By the numbers: 45 screens, 51 shared components, about 19,400 lines of TypeScript and 4,600 lines of SQL, 31 database tables all protected by row-level security, and more than 1,400 interface strings in both English and Indonesian.");
  }

  // 22. Latest improvements
  {
    const s = content(pres, 22, "End results · latest", "Recent improvements, live now");
    const items = [
      [fa.FaImage, "Banners always fit", "Event banners of any shape now show in full over a soft blurred background, instead of being cropped."],
      [fa.FaQrcode, "Flyer generator", "Organizers and admins make a branded flyer in 9:16, 1:1 or 16:9, with QR code, and download PNG/JPG or share."],
      [fa.FaTools, "Event creation fixed", "A database fix (migration 010) made event codes like COM-JAT-3962 generate reliably again."],
      [fa.FaShieldAlt, "Security upgrade", "Next.js 16.3.6 with its security fixes, and code checks restored with 0 errors."],
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
    text(s, "Try it now", { x: 8.75, y: 5.3, w: 3.85, h: 0.4, fontSize: 17, bold: true, color: C.ink, align: "center" });
    text(s, "komunitasa.vercel.app", { x: 8.75, y: 5.7, w: 3.85, h: 0.35, fontSize: 13, color: C.deep, align: "center" });
    s.addNotes("The most recent changes: banners of any shape now display in full, organizers and admins can generate flyers in three sizes, event creation was fixed with a small database migration, and the framework was upgraded for security.");
  }

  // 23. Known gaps & next steps
  {
    const s = content(pres, 23, "What's next", "Known gaps and next steps");
    const gaps = [
      ["Stronger second factor", "Move the email-code step into a server-side login endpoint, or use Supabase MFA."],
      ["Scheduled reports", "Weekly and monthly admin emails need a scheduler and a server key."],
      ["Contact privacy", "Hide the organizer's WhatsApp at the database level, not only in the UI."],
      ["Full account deletion", "Anonymizing works today; removing the login needs a server-side step."],
      ["Big exports", "Exports run in the browser and cap at 10,000 rows per dataset."],
      ["Code tidy-up", "Clear the 24 remaining lint warnings over time."],
    ];
    for (let i = 0; i < gaps.length; i++) {
      const col = i % 2, r = Math.floor(i / 2);
      const x = 0.7 + col * 6.1, y = 2.0 + r * 1.45;
      card(pres, s, x, y, 5.8, 1.25);
      text(s, String(i + 1), { x: x + 0.25, y: y + 0.25, w: 0.5, h: 0.75, fontSize: 30, bold: true, color: C.peach, valign: "middle" });
      text(s, gaps[i][0], { x: x + 0.9, y: y + 0.2, w: 4.7, h: 0.38, fontSize: 16, bold: true, color: C.ink });
      text(s, gaps[i][1], { x: x + 0.9, y: y + 0.58, w: 4.7, h: 0.6, fontSize: 12.5, color: C.muted, valign: "top" });
    }
    s.addNotes("We're open about what's left: a stronger second sign-in factor, scheduled reports, hiding organizer phone numbers at the database level, full account deletion, larger exports, and cleaning up the remaining lint warnings.");
  }

  // 24. Closing
  {
    const s = pres.addSlide();
    s.background = { data: grad };
    s.addImage({ data: logoCream, x: (W - 1.2) / 2, y: 1.2, w: 1.2, h: 1.2 });
    text(s, "Thank you", { x: 0.7, y: 2.7, w: W - 1.4, h: 1.0, fontSize: 54, bold: true, color: C.cream, align: "center" });
    text(s, "Find activities. Meet people. Build community.", { x: 0.7, y: 3.7, w: W - 1.4, h: 0.6, fontSize: 22, color: C.peach, align: "center" });
    const pw = 5.2;
    pill(pres, s, (W - pw) / 2, 4.75, pw, 0.75, C.cream);
    text(s, "komunitasa.vercel.app", { x: (W - pw) / 2, y: 4.75, w: pw, h: 0.75, fontSize: 24, bold: true, color: C.deep, align: "center", valign: "middle" });
    text(s, "A Team · Capstone Project · Universitas Terbuka", { x: 0.7, y: 6.3, w: W - 1.4, h: 0.4, fontSize: 15, bold: true, color: C.peach, align: "center" });
    s.addNotes("Thank you from A Team. We're happy to take questions, and please try Komunitas on your phone.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
