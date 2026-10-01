// Flat SVG illustrations for the landing slideshow (viewBox 480×360).
// Motion comes from the `ks-*` classes in globals.css; elements that animate
// are wrapped in their own <g> so the CSS transform doesn't fight SVG
// `transform` attributes. Colors are fixed so each scene reads as a picture in
// light and dark mode.

import { markShapes } from "@/components/Logo";

const INK = "#292524";
const SKIN = ["#F1C27D", "#C68642", "#E0AC69", "#8D5524"];

type Delay = { delay?: string };

/** Hair cap (drawn over the head) or hijab (drawn behind it) for a head at (0, cy) with radius r. */
function Hair({ cy, r, color = INK, hijab }: { cy: number; r: number; color?: string; hijab?: string }) {
  return (
    <g transform={`translate(0 ${cy}) scale(${r / 17})`}>
      {hijab ? (
        <path d="M-21 -1a21 21 0 0 1 42 0v12c0 12-9 21-21 21s-21-9-21-21z" fill={hijab} />
      ) : (
        <path d="M-17.5 0a17.5 17.5 0 0 1 35 0c-6-5-12-7-17.5-7s-11.5 2-17.5 7z" fill={color} />
      )}
    </g>
  );
}

/** Side-view runner facing right; hip at the origin. */
function Runner({ x, y, skin, shirt, shorts, hair, hijab, delay = "0s" }: {
  x: number; y: number; skin: string; shirt: string; shorts: string; hair?: string; hijab?: string;
} & Delay) {
  const limb = (cls: string, color: string, len: number, w: number, shoe?: boolean) => (
    <g className={cls} style={{ animationDelay: delay }}>
      <line x1="0" y1="0" x2="0" y2={len} stroke={color} strokeWidth={w} strokeLinecap="round" />
      {shoe && <ellipse cx="0" cy={len + 2} rx="7" ry="4" fill={INK} />}
    </g>
  );
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="4" cy="52" rx="24" ry="5" fill="#000" opacity=".08" />
      <g className="ks-bob" style={{ animationDelay: delay }}>
        <g transform="translate(4 -40)">{limb("ks-swing-b", skin, 26, 7)}</g>
        <g transform="translate(0 4)">{limb("ks-swing-a", skin, 40, 8, true)}</g>
        <rect x="-11" y="-50" width="24" height="54" rx="11" fill={shirt} transform="rotate(8)" />
        <rect x="-11" y="-6" width="22" height="15" rx="6" fill={shorts} />
        <g transform="translate(0 4)">{limb("ks-swing-b", skin, 40, 8, true)}</g>
        <g transform="translate(6 -40)">{limb("ks-swing-a", skin, 26, 7)}</g>
        <g transform="translate(10 -6) scale(.78)">
          {hijab && <Hair cy={-72} r={16} hijab={hijab} />}
          <circle cx="0" cy="-72" r="16" fill={skin} />
          {!hijab && <Hair cy={-72} r={16} color={hair} />}
          <circle cx="7" cy="-73" r="1.8" fill={INK} />
        </g>
      </g>
    </g>
  );
}

/** Front-view upper body (for seated scenes); shoulders at y, body going down. */
function Bust({ x, y, skin, shirt, hair, hijab, children }: {
  x: number; y: number; skin: string; shirt: string; hair?: string; hijab?: string; children?: React.ReactNode;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect x="-24" y="0" width="48" height="70" rx="20" fill={shirt} />
      <g transform="translate(0 12)">
        {hijab && <Hair cy={-30} r={17} hijab={hijab} />}
        <circle cx="0" cy="-30" r="17" fill={skin} />
        {!hijab && <Hair cy={-30} r={17} color={hair} />}
        <circle cx="-6" cy="-31" r="1.8" fill={INK} />
        <circle cx="6" cy="-31" r="1.8" fill={INK} />
        <path d="M-5 -23q5 4 10 0" stroke={INK} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      </g>
      {children}
    </g>
  );
}

/** Front-view standing kid in school uniform; feet at the origin. */
function Student({ x, y, skin, hair, hijab, bottom, children, wave }: {
  x: number; y: number; skin: string; hair?: string; hijab?: string; bottom: string; children?: React.ReactNode; wave?: boolean;
}) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="2" rx="22" ry="4" fill="#000" opacity=".08" />
      <rect x="-13" y="-36" width="10" height="36" rx="4" fill={skin} />
      <rect x="3" y="-36" width="10" height="36" rx="4" fill={skin} />
      <ellipse cx="-8" cy="-1" rx="8" ry="4" fill={INK} />
      <ellipse cx="8" cy="-1" rx="8" ry="4" fill={INK} />
      <rect x="-17" y="-52" width="34" height="22" rx="6" fill={bottom} />
      <rect x="-18" y="-90" width="36" height="44" rx="14" fill="#FFFFFF" stroke="#E7E5E4" />
      <line x1="-18" y1="-80" x2="-24" y2="-54" stroke={skin} strokeWidth="7" strokeLinecap="round" />
      {wave ? (
        <g transform="translate(18 -82)">
          <g className="ks-wave-arm">
            <line x1="0" y1="0" x2="0" y2="-26" stroke={skin} strokeWidth="7" strokeLinecap="round" />
          </g>
        </g>
      ) : (
        <line x1="18" y1="-80" x2="24" y2="-54" stroke={skin} strokeWidth="7" strokeLinecap="round" />
      )}
      <g transform="translate(0 -48)">
        {hijab && <Hair cy={-58} r={15} hijab={hijab} />}
        <circle cx="0" cy="-58" r="15" fill={skin} />
        {!hijab && <Hair cy={-58} r={15} color={hair} />}
        <circle cx="-5" cy="-59" r="1.6" fill={INK} />
        <circle cx="5" cy="-59" r="1.6" fill={INK} />
        <path d="M-4 -52q4 3 8 0" stroke={INK} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      </g>
      {children}
    </g>
  );
}

/** Open book held at chest height by a Bust; the right page turns when `flip`. */
function OpenBook({ skin, cover, flip }: { skin: string; cover: string; flip?: boolean }) {
  return (
    <g transform="translate(0 50)">
      <path d="M-34 -2l34 6 34 -6v26l-34 6-34-6z" fill={cover} />
      <path d="M-30 -4l30 5v24l-30-5z" fill="#FFFFFF" />
      <path d="M30 -4l-30 5v24l30-5z" fill="#FFF7EC" />
      {[4, 10, 16].map((ly) => (
        <g key={ly} stroke="#D6D3D1" strokeWidth="1.4" strokeLinecap="round">
          <line x1="-24" y1={ly - 1} x2="-6" y2={ly + 2} />
          <line x1="6" y1={ly + 2} x2="24" y2={ly - 1} />
        </g>
      ))}
      {flip && (
        <g className="ks-flip">
          <path d="M0 1l28 -5v24l-28 5z" fill="#FFFFFF" stroke="#E7E5E4" strokeWidth="1" />
        </g>
      )}
      <circle cx="-34" cy="14" r="7" fill={skin} />
      <circle cx="34" cy="14" r="7" fill={skin} />
    </g>
  );
}

function Tree({ x, y, s = 1, c = "#5FAF7B" }: { x: number; y: number; s?: number; c?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <rect x="-4" y="-30" width="8" height="30" rx="3" fill="#A16207" />
      <circle cx="0" cy="-46" r="24" fill={c} />
      <circle cx="-14" cy="-36" r="14" fill={c} />
      <circle cx="14" cy="-38" r="15" fill={c} />
    </g>
  );
}

function Cloud({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="#FFFFFF" opacity=".9">
      <ellipse cx="0" cy="0" rx="30" ry="12" />
      <ellipse cx="-14" cy="-8" rx="14" ry="11" />
      <ellipse cx="10" cy="-11" rx="16" ry="13" />
    </g>
  );
}

function Heart({ x, y, c = "#F43F5E", delay = "0s" }: { x: number; y: number; c?: string } & Delay) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <g className="ks-float" style={{ animationDelay: delay }}>
        <path d="M0 6c-9-6-12-10-12-14a6 6 0 0 1 12-2 6 6 0 0 1 12 2c0 4-3 8-12 14z" fill={c} />
      </g>
    </g>
  );
}

export function RunScene() {
  const trees = [0, 120, 240, 360, 480, 600, 720, 840];
  return (
    <svg viewBox="0 0 480 360" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="ks-sky1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFD9B0" />
          <stop offset="1" stopColor="#FFF4E4" />
        </linearGradient>
      </defs>
      <rect width="480" height="360" fill="url(#ks-sky1)" />
      <circle cx="380" cy="78" r="46" fill="#FDBA74" opacity=".35" />
      <circle cx="380" cy="78" r="30" fill="#FB923C" />
      <g className="ks-drift"><Cloud x={90} y={70} /><Cloud x={250} y={45} s={0.7} /></g>
      <path d="M0 220q120-70 240-20t240-30v190H0z" fill="#FBD6A8" />
      <g className="ks-scroll">
        {trees.map((tx) => (
          <Tree key={tx} x={tx + 40} y={238} s={tx % 240 === 0 ? 1 : 0.8} c={tx % 240 === 0 ? "#5FAF7B" : "#86C59A"} />
        ))}
      </g>
      <rect y="236" width="480" height="124" fill="#F3DCBC" />
      <rect y="292" width="480" height="44" fill="#E9A774" />
      <line x1="0" y1="314" x2="480" y2="314" stroke="#FFF8ED" strokeWidth="3" strokeDasharray="22 18" className="ks-dash" />
      <Runner x={140} y={262} skin={SKIN[1]} shirt="#F97316" shorts={INK} hair={INK} delay="-0.2s" />
      <Runner x={240} y={258} skin={SKIN[0]} shirt="#14B8A6" shorts="#1E3A8A" hijab="#F43F5E" delay="0s" />
      <Runner x={340} y={264} skin={SKIN[3]} shirt="#6366F1" shorts={INK} hair={INK} delay="-0.45s" />
    </svg>
  );
}

export function ReadScene() {
  const spines = ["#F97316", "#14B8A6", "#6366F1", "#F59E0B", "#F43F5E", "#0EA5E9", "#84CC16"];
  return (
    <svg viewBox="0 0 480 360" className="h-full w-full" aria-hidden>
      <rect width="480" height="360" fill="#FDEBD3" />
      <rect y="270" width="480" height="90" fill="#E8C9A0" />
      {/* window */}
      <rect x="36" y="40" width="120" height="110" rx="10" fill="#FFF4E4" stroke="#C2410C" strokeWidth="6" />
      <clipPath id="ks-win"><rect x="39" y="43" width="114" height="104" rx="8" /></clipPath>
      <g clipPath="url(#ks-win)">
        <rect x="39" y="43" width="114" height="104" fill="#FFE2BF" />
        <g className="ks-drift"><Cloud x={80} y={80} s={0.6} /></g>
      </g>
      <line x1="96" y1="40" x2="96" y2="150" stroke="#C2410C" strokeWidth="5" />
      {/* shelf */}
      {[70, 140].map((sy) => (
        <g key={sy}>
          {spines.map((c, i) => (
            <rect key={i} x={318 + i * 18} y={sy - 44 + (i % 3) * 4} width="14" height={44 - (i % 3) * 4} rx="2" fill={c} />
          ))}
          <rect x="310" y={sy} width="140" height="7" rx="3" fill="#A16207" />
        </g>
      ))}
      {/* lamp */}
      <g transform="translate(240 0)">
        <g className="ks-sway">
          <line x1="0" y1="0" x2="0" y2="62" stroke={INK} strokeWidth="2" />
          <path d="M-26 86l10-24h32l10 24z" fill="#F97316" />
          <ellipse cx="0" cy="92" rx="30" ry="10" fill="#FDE68A" opacity=".55" />
        </g>
      </g>
      {/* readers */}
      <Bust x={130} y={176} skin={SKIN[2]} shirt="#6366F1" hijab="#0F766E"><OpenBook skin={SKIN[2]} cover="#F59E0B" /></Bust>
      <Bust x={240} y={168} skin={SKIN[0]} shirt="#F97316" hair={INK}><OpenBook skin={SKIN[0]} cover="#14B8A6" flip /></Bust>
      <Bust x={350} y={176} skin={SKIN[3]} shirt="#14B8A6" hair="#44403C"><OpenBook skin={SKIN[3]} cover="#F43F5E" /></Bust>
      <Heart x={292} y={150} delay="0s" />
      <Heart x={176} y={160} c="#F97316" delay="-1.2s" />
      {/* table + books + cup */}
      <rect x="40" y="246" width="400" height="18" rx="6" fill="#B7794A" />
      <rect x="70" y="264" width="12" height="70" fill="#9A5B2F" />
      <rect x="398" y="264" width="12" height="70" fill="#9A5B2F" />
      <g transform="translate(410 246)">
        <rect x="-12" y="-22" width="22" height="22" rx="4" fill="#FFFFFF" stroke="#E7E5E4" />
        <path d="M10 -16a6 6 0 0 1 0 10" stroke="#E7E5E4" strokeWidth="3" fill="none" />
        {[-5, 3].map((sx, i) => (
          <g key={sx} transform={`translate(${sx} -28)`}>
            <path className="ks-steam" style={{ animationDelay: `${i * -1.1}s` }} d="M0 0c-4-6 4-10 0-16" stroke="#A8A29E" strokeWidth="2" fill="none" strokeLinecap="round" />
          </g>
        ))}
      </g>
    </svg>
  );
}

export function SchoolScene() {
  return (
    <svg viewBox="0 0 480 360" className="h-full w-full" aria-hidden>
      <rect width="480" height="360" fill="#FFEFD9" />
      <g className="ks-drift"><Cloud x={70} y={56} s={0.8} /><Cloud x={300} y={40} s={0.6} /></g>
      {/* school building */}
      <path d="M150 120l110-46 110 46z" fill="#C2410C" />
      <rect x="160" y="118" width="200" height="110" fill="#FFF8ED" stroke="#F3DCBC" strokeWidth="3" />
      {[0, 1, 2, 3].map((i) => (
        <rect key={i} x={176 + i * 46} y="136" width="30" height="28" rx="3" fill="#BAE6FD" stroke="#F3DCBC" strokeWidth="3" />
      ))}
      <rect x="244" y="180" width="32" height="48" rx="3" fill="#A16207" />
      <circle cx="260" cy="100" r="9" fill="#FFF8ED" stroke="#C2410C" strokeWidth="3" />
      {/* flagpole */}
      <line x1="410" y1="70" x2="410" y2="236" stroke="#78716C" strokeWidth="4" strokeLinecap="round" />
      <g transform="translate(412 74)">
        <g className="ks-flag">
          <rect x="0" y="0" width="46" height="15" fill="#DC2626" />
          <rect x="0" y="15" width="46" height="15" fill="#FFFFFF" stroke="#E7E5E4" strokeWidth=".5" />
        </g>
      </g>
      <rect y="228" width="480" height="132" fill="#BFE3B4" />
      <Tree x={70} y={232} s={1.1} />
      {/* sapling being planted */}
      <g transform="translate(250 300)">
        <ellipse cx="0" cy="0" rx="26" ry="7" fill="#92400E" opacity=".6" />
        <g className="ks-grow">
          <line x1="0" y1="0" x2="0" y2="-34" stroke="#15803D" strokeWidth="4" strokeLinecap="round" />
          <path d="M0 -24c-14-2-18-12-16-18 10 0 16 8 16 18z" fill="#22C55E" />
          <path d="M0 -30c12-2 16-12 14-18-10 0-14 8-14 18z" fill="#4ADE80" />
        </g>
      </g>
      {/* watering can + drops */}
      <g transform="translate(298 262)">
        <path d="M-8 -6l-26 -10" stroke="#0EA5E9" strokeWidth="5" strokeLinecap="round" />
        <rect x="-8" y="-16" width="28" height="22" rx="5" fill="#0EA5E9" />
        {[0, 1, 2].map((i) => (
          <g key={i} transform={`translate(${-36 + i * 5} -12)`}>
            <circle className="ks-drop" style={{ animationDelay: `${i * -0.35}s` }} r="2.6" fill="#38BDF8" />
          </g>
        ))}
      </g>
      <Student x={180} y={318} skin={SKIN[1]} hair={INK} bottom="#B91C1C" wave />
      <Student x={330} y={322} skin={SKIN[2]} hijab="#FFFFFF" bottom="#B91C1C" />
      <Student x={400} y={326} skin={SKIN[0]} hair="#44403C" bottom="#1E3A8A" />
    </svg>
  );
}

export function GatherScene() {
  return (
    <svg viewBox="0 0 480 360" className="h-full w-full" aria-hidden>
      <defs>
        <linearGradient id="ks-sky4" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FED7AA" />
          <stop offset="1" stopColor="#FFF4E4" />
        </linearGradient>
        <linearGradient id="ks-tile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FB923C" />
          <stop offset="1" stopColor="#EA580C" />
        </linearGradient>
      </defs>
      <rect width="480" height="360" fill="url(#ks-sky4)" />
      <path d="M0 210q120-40 240-10t240-10v170H0z" fill="#C7E9B8" />
      <Tree x={50} y={226} s={1.2} />
      <Tree x={430} y={220} s={1} c="#86C59A" />
      {/* brand mark */}
      <g transform="translate(240 40)">
        <g className="ks-bob-slow">
          <rect x="-34" y="0" width="68" height="68" rx="20" fill="url(#ks-tile)" />
          <g transform="translate(-34 0) scale(1.4167)">
            {markShapes()}
          </g>
        </g>
      </g>
      <ellipse cx="240" cy="300" rx="190" ry="42" fill="#FCA5A5" opacity=".55" />
      <ellipse cx="240" cy="300" rx="190" ry="42" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeDasharray="10 10" opacity=".7" />
      <Bust x={100} y={218} skin={SKIN[3]} shirt="#F59E0B" hair={INK} />
      <Bust x={190} y={206} skin={SKIN[0]} shirt="#14B8A6" hijab="#6366F1" />
      <Bust x={290} y={206} skin={SKIN[2]} shirt="#F43F5E" hair="#44403C" />
      <Bust x={380} y={218} skin={SKIN[1]} shirt="#6366F1" hair={INK} />
      <Heart x={150} y={170} delay="-0.4s" />
      <Heart x={340} y={164} c="#F97316" delay="-1.6s" />
      <Heart x={240} y={150} c="#F59E0B" delay="-2.4s" />
      {/* snacks */}
      <g transform="translate(240 300)">
        <rect x="-26" y="-8" width="52" height="16" rx="8" fill="#FFF8ED" />
        <circle cx="-12" cy="-8" r="6" fill="#F97316" />
        <circle cx="2" cy="-9" r="6" fill="#84CC16" />
        <circle cx="15" cy="-8" r="6" fill="#F59E0B" />
      </g>
    </svg>
  );
}
