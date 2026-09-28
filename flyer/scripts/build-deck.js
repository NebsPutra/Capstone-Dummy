// Builds ../capstone-a-team-deck.pptx (7 slides, 16:9, Orange/Cream branding).
// Usage: cd flyer/scripts && npm install && node build-deck.js
const path = require("path");
const pptxgen = require("pptxgenjs");
const sharp = require("sharp");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const QRCode = require("qrcode");
const fa = require("react-icons/fa");
const md = require("react-icons/md");

const OUT = path.join(__dirname, "..", "capstone-a-team-deck.pptx");
const LOGO = path.join(__dirname, "..", "a-team-logo.png");

const C = {
  cream: "FFF8ED", warm: "F8E8D0", peach: "FED7AA", orange: "F97316", deep: "C2410C",
  ink: "292524", body: "44403C", muted: "78716C", white: "FFFFFF", green: "16A34A",
};
const FONT = "Arial";
const W = 13.333;

async function png(svg, size) {
  const buf = await sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}
async function icon(Comp, color, size = 256) {
  const svg = renderToStaticMarkup(React.createElement(Comp, { color: "#" + color, size }));
  return png(svg, size);
}
async function gradient(w, h) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
    <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FB923C"/><stop offset="1" stop-color="#C2410C"/></linearGradient>
      <radialGradient id="r" cx="0.85" cy="0.15" r="0.6"><stop offset="0" stop-color="#FFF8ED" stop-opacity="0.22"/>
      <stop offset="1" stop-color="#FFF8ED" stop-opacity="0"/></radialGradient></defs>
    <rect width="100%" height="100%" fill="url(#g)"/><rect width="100%" height="100%" fill="url(#r)"/></svg>`;
  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + buf.toString("base64");
}

const shadow = () => ({ type: "outer", color: "C2410C", blur: 14, offset: 3, angle: 90, opacity: 0.12 });
const text = (slide, t, o) => slide.addText(t, { fontFace: FONT, isTextBox: true, margin: 0, ...o });
const card = (pres, slide, x, y, w, h, fill = C.white) =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.22, fill: { color: fill }, line: { color: "EFE6DA", width: 0.75 }, shadow: shadow() });
const tile = (pres, slide, x, y, s, fill = C.orange) =>
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w: s, h: s, rectRadius: s * 0.27, fill: { color: fill }, line: { type: "none" } });

function header(slide, eyebrow, title) {
  text(slide, eyebrow.toUpperCase(), { x: 0.7, y: 0.55, w: 9, h: 0.35, fontSize: 13, bold: true, color: C.deep, charSpacing: 3 });
  text(slide, title, { x: 0.7, y: 0.9, w: 11.9, h: 0.8, fontSize: 36, bold: true, color: C.ink });
}
function footer(slide, n) {
  slide.addImage({ path: LOGO, x: 0.7, y: 6.82, w: 0.32, h: 0.32 });
  text(slide, "Capstone Project · A Team", { x: 1.12, y: 6.82, w: 5, h: 0.32, fontSize: 11, color: C.muted, valign: "middle" });
  text(slide, String(n), { x: W - 1.2, y: 6.82, w: 0.5, h: 0.32, fontSize: 11, color: C.muted, align: "right", valign: "middle" });
}

(async () => {
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.title = "Capstone Project · A Team";
  pres.author = "A Team";

  const grad = await gradient(1920, 1080);
  // Cream variant of the logo so it stands out on the orange title/closing slides
  const logoCream = await png(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><rect width="48" height="48" rx="13" fill="#FFF8ED"/><path d="M12.5 37.5 24 11.5l11.5 26" fill="none" stroke="#EA580C" stroke-width="5.2" stroke-linecap="round" stroke-linejoin="round"/><path d="M17.6 28.4Q24 34 30.4 28.4" fill="none" stroke="#EA580C" stroke-width="3.4" stroke-linecap="round"/></svg>`, 512);
  const qrSvg = await QRCode.toString("https://komunitasa.vercel.app", { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#292524", light: "#FFF8ED" } });
  const qr = await png(qrSvg, 800);

  // 1. Title
  {
    const s = pres.addSlide();
    s.background = { data: grad };
    s.addImage({ data: logoCream, x: 0.8, y: 0.8, w: 1.1, h: 1.1 });
    text(s, "CAPSTONE PROJECT", { x: 0.8, y: 2.55, w: 10, h: 0.5, fontSize: 20, bold: true, color: C.peach, charSpacing: 6 });
    text(s, "A Team", { x: 0.8, y: 3.0, w: 11, h: 1.6, fontSize: 96, bold: true, color: C.cream });
    text(s, "Komunitas: our community activity platform is set up, secured and live.", { x: 0.8, y: 4.7, w: 10.5, h: 0.6, fontSize: 22, color: C.cream });
    text(s, "komunitasa.vercel.app   ·   28 September 2026", { x: 0.8, y: 6.45, w: 10, h: 0.4, fontSize: 16, bold: true, color: C.peach });
    s.addNotes("Welcome. We're A Team, and this is our capstone project, Komunitas. This short deck covers how we set up our new workspace, secured and checked the app, and put the latest version live.");
  }

  // 2. Meet Komunitas
  {
    const s = pres.addSlide();
    s.background = { color: C.cream };
    header(s, "Meet Komunitas", "Find, create and join local activities");
    text(s, [
      { text: "Komunitas helps people discover social activities happening near them, or start their own.", options: { breakLine: true, paraSpaceAfter: 14 } },
      { text: "Browse what's on within 20 km, join in one tap, and share events by link, WhatsApp or QR code.", options: { breakLine: true, paraSpaceAfter: 14 } },
      { text: "Your exact location is used only in the moment. It is never stored.", options: { bold: true, color: C.deep } },
    ], { x: 0.7, y: 2.0, w: 5.4, h: 3.6, fontSize: 18, color: C.body, valign: "top", lineSpacingMultiple: 1.15 });

    const acts = [
      [fa.FaRunning, "Running"], [fa.FaBookOpen, "Reading"], [fa.FaBicycle, "Cycling"],
      [md.MdSportsTennis, "Badminton"], [fa.FaBasketballBall, "Basketball"], [fa.FaUsers, "Gatherings"],
    ];
    const gx = 6.75, gy = 2.0, cw = 1.85, ch = 1.9, gap = 0.2;
    for (let i = 0; i < acts.length; i++) {
      const x = gx + (i % 3) * (cw + gap), y = gy + Math.floor(i / 3) * (ch + gap);
      card(pres, s, x, y, cw, ch);
      tile(pres, s, x + (cw - 0.8) / 2, y + 0.3, 0.8, C.warm);
      s.addImage({ data: await icon(acts[i][0], C.deep), x: x + (cw - 0.46) / 2, y: y + 0.47, w: 0.46, h: 0.46 });
      text(s, acts[i][1], { x, y: y + 1.25, w: cw, h: 0.4, fontSize: 15, bold: true, color: C.ink, align: "center" });
    }
    footer(s, 2);
    s.addNotes("Komunitas is a mobile-first web app for local social activities: running, reading, cycling, badminton, basketball and community gatherings. Location privacy is built in; live GPS is only used at request time.");
  }

  // 3. The update at a glance
  {
    const s = pres.addSlide();
    s.background = { color: C.cream };
    header(s, "The update at a glance", "Four steps from a new laptop to a live site");
    const steps = [
      [fa.FaLaptopCode, "01", "Set up", "A fresh workspace, connected to GitHub and Vercel."],
      [fa.FaShieldAlt, "02", "Secured", "Latest Next.js with its security fixes applied."],
      [fa.FaCheckDouble, "03", "Checked", "Code checks, type checks and a full build, all passing."],
      [fa.FaRocket, "04", "Live", "Redeployed to production on 28 September 2026."],
    ];
    const cw = 2.65, gap = 0.45, x0 = 0.7, y = 2.3, ch = 3.25;
    for (let i = 0; i < steps.length; i++) {
      const x = x0 + i * (cw + gap);
      card(pres, s, x, y, cw, ch);
      tile(pres, s, x + 0.35, y + 0.4, 0.85);
      s.addImage({ data: await icon(steps[i][0], C.cream), x: x + 0.55, y: y + 0.6, w: 0.45, h: 0.45 });
      text(s, steps[i][1], { x: x + 1.4, y: y + 0.55, w: 1, h: 0.5, fontSize: 22, bold: true, color: C.deep, valign: "middle" });
      text(s, steps[i][2], { x: x + 0.35, y: y + 1.55, w: cw - 0.7, h: 0.5, fontSize: 24, bold: true, color: C.ink });
      text(s, steps[i][3], { x: x + 0.35, y: y + 2.1, w: cw - 0.7, h: 1.2, fontSize: 15, color: C.muted, valign: "top" });
      if (i < steps.length - 1)
        s.addImage({ data: await icon(fa.FaChevronRight, C.orange), x: x + cw + 0.12, y: y + ch / 2 - 0.1, w: 0.2, h: 0.2 });
    }
    footer(s, 3);
    s.addNotes("The whole update in four steps. We'll go through each one briefly.");
  }

  // 4. Set up
  {
    const s = pres.addSlide();
    s.background = { color: C.cream };
    header(s, "01 · Set up", "A new device, ready to build in one session");
    const rows = [
      [fa.FaCodeBranch, "Git + GitHub", "Full project history on the new laptop, signed in and in sync with our GitHub repository."],
      [fa.FaNodeJs, "Node.js 24 (LTS)", "The runtime that builds and runs the app locally, installed from the official release."],
      [fa.FaCloudUploadAlt, "Vercel", "Linked to the live project, with its settings pulled down securely."],
      [fa.FaKey, "Private keys", "Stored only on this machine and on Vercel. Never committed to GitHub."],
    ];
    for (let i = 0; i < rows.length; i++) {
      const y = 2.0 + i * 1.12;
      tile(pres, s, 0.7, y, 0.8);
      s.addImage({ data: await icon(rows[i][0], C.cream), x: 0.9, y: y + 0.2, w: 0.4, h: 0.4 });
      text(s, rows[i][1], { x: 1.75, y: y - 0.02, w: 5.6, h: 0.4, fontSize: 18, bold: true, color: C.ink });
      text(s, rows[i][2], { x: 1.75, y: y + 0.38, w: 5.6, h: 0.5, fontSize: 14, color: C.muted, valign: "top" });
    }
    card(pres, s, 8.1, 2.0, 4.5, 4.2, C.white);
    text(s, "4", { x: 8.1, y: 2.45, w: 4.5, h: 1.6, fontSize: 110, bold: true, color: C.orange, align: "center" });
    text(s, "tools connected", { x: 8.1, y: 4.1, w: 4.5, h: 0.5, fontSize: 22, bold: true, color: C.ink, align: "center" });
    text(s, "From an empty laptop to a working copy of the live app, checked end to end.", { x: 8.55, y: 4.75, w: 3.6, h: 1.0, fontSize: 14, color: C.muted, align: "center", valign: "top" });
    footer(s, 4);
    s.addNotes("On the new device we installed Git and Node.js, connected GitHub and Vercel, and pulled the project's settings securely. Secret keys stay on this machine and on Vercel only.");
  }

  // 5. Secured & checked
  {
    const s = pres.addSlide();
    s.background = { color: C.cream };
    header(s, "02 · Secured   ·   03 · Checked", "Safer and verified before release");
    const stats = [
      ["16.3.6", "Next.js version", "Upgraded from 16.2.6 to pick up the latest security fixes."],
      ["0", "critical or high issues", "All serious dependency warnings resolved."],
      ["0", "code-check errors", "Linting restored and its two real issues fixed."],
      ["100%", "of pages built", "Full production build tested before going live."],
    ];
    const cw = 2.8, gap = 0.3, x0 = 0.7, y = 2.1, ch = 3.9;
    for (let i = 0; i < stats.length; i++) {
      const x = x0 + i * (cw + gap);
      card(pres, s, x, y, cw, ch);
      text(s, stats[i][0], { x: x + 0.3, y: y + 0.4, w: cw - 0.6, h: 1.2, fontSize: stats[i][0].length > 3 ? 48 : 66, bold: true, color: C.orange, valign: "middle" });
      text(s, stats[i][1], { x: x + 0.3, y: y + 1.75, w: cw - 0.6, h: 0.75, fontSize: 18, bold: true, color: C.ink, valign: "top" });
      text(s, stats[i][2], { x: x + 0.3, y: y + 2.55, w: cw - 0.6, h: 1.1, fontSize: 14, color: C.muted, valign: "top" });
    }
    footer(s, 5);
    s.addNotes("We upgraded Next.js from 16.2.6 to 16.3.6, which cleared the critical and high security warnings. Two moderate warnings remain inside a spreadsheet library and don't affect how we use it. We also restored code checks, which the framework upgrade had broken, and fixed the two real errors they found. Then we built and tested the full site before deploying.");
  }

  // 6. Live
  {
    const s = pres.addSlide();
    s.background = { color: C.cream };
    header(s, "04 · Live", "The latest version is live now");
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 2.1, w: 4.4, h: 0.55, rectRadius: 0.27, fill: { color: C.white }, line: { color: "EFE6DA", width: 0.75 } });
    s.addShape(pres.shapes.OVAL, { x: 0.92, y: 2.28, w: 0.19, h: 0.19, fill: { color: C.green }, line: { type: "none" } });
    text(s, "Ready · Production · 28 Sep 2026", { x: 1.25, y: 2.1, w: 3.8, h: 0.55, fontSize: 14, bold: true, color: C.ink, valign: "middle" });
    text(s, "Visit", { x: 0.7, y: 3.1, w: 6, h: 0.45, fontSize: 18, color: C.muted });
    text(s, "komunitasa.vercel.app", { x: 0.7, y: 3.5, w: 7.2, h: 0.9, fontSize: 40, bold: true, color: C.deep });
    text(s, [
      { text: "Sign up with your email, pick your hobbies, and see what's happening near you.", options: { breakLine: true, paraSpaceAfter: 10 } },
      { text: "Every new change now goes through the same checks before it reaches the live site." },
    ], { x: 0.7, y: 4.6, w: 6.6, h: 1.4, fontSize: 16, color: C.body, valign: "top" });
    card(pres, s, 8.6, 1.95, 4.0, 4.4, C.white);
    s.addImage({ data: qr, x: 9.1, y: 2.35, w: 3.0, h: 3.0 });
    text(s, "Scan to open the app", { x: 8.6, y: 5.6, w: 4.0, h: 0.45, fontSize: 15, bold: true, color: C.ink, align: "center" });
    footer(s, 6);
    s.addNotes("The new version is live on komunitasa.vercel.app. Scan the QR code to try it on your phone.");
  }

  // 7. Closing
  {
    const s = pres.addSlide();
    s.background = { data: grad };
    s.addImage({ data: logoCream, x: (W - 1.3) / 2, y: 1.35, w: 1.3, h: 1.3 });
    text(s, "Ready for what's next", { x: 0.7, y: 2.95, w: W - 1.4, h: 1.0, fontSize: 48, bold: true, color: C.cream, align: "center" });
    text(s, "Thank you from A Team", { x: 0.7, y: 3.95, w: W - 1.4, h: 0.6, fontSize: 24, color: C.peach, align: "center" });
    const pw = 5.2;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: (W - pw) / 2, y: 5.05, w: pw, h: 0.75, rectRadius: 0.37, fill: { color: C.cream }, line: { type: "none" } });
    text(s, "komunitasa.vercel.app", { x: (W - pw) / 2, y: 5.05, w: pw, h: 0.75, fontSize: 24, bold: true, color: C.deep, align: "center", valign: "middle" });
    s.addNotes("Thank you. Questions are welcome, and please give Komunitas a try.");
  }

  await pres.writeFile({ fileName: OUT });
  console.log("wrote", OUT);
})();
