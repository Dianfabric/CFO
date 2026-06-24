"use client";

import { useMemo, useRef, useState } from "react";
import JSZip from "jszip";

// ── 캔버스 규격: 인스타 4:5 세로 (1080×1350) ──────────────
const W = 1080;
const H = 1350;
const CX = W / 2;
const MARGIN = 110;

// 색동(오방색) 정제 팔레트 — 얇은 스트라이프 모티프용 (청·적·황·흑)
const OBANG = ["#2E6E6A", "#B5392E", "#D9A441", "#2A2622"];

// 테마(배경 무드)
type ThemeKey = "cream" | "dark";
interface Theme {
  bg: string;
  ink: string;
  muted: string;
  hair: string;
  light: boolean;
}
const THEMES: Record<ThemeKey, Theme> = {
  cream: { bg: "#FFFFFF", ink: "#1F1B16", muted: "#8A8073", hair: "#E6E0D6", light: true },
  dark: { bg: "#161310", ink: "#F2ECE0", muted: "#9A9082", hair: "#34302A", light: false },
};
// 배경 사진 위에 올릴 때(가독성 위해 흰 텍스트 + 스크림)
const PHOTO_THEME: Theme = {
  bg: "#000000",
  ink: "#FFFFFF",
  muted: "rgba(255,255,255,0.82)",
  hair: "rgba(255,255,255,0.32)",
  light: false,
};
function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const ir = img.naturalWidth / img.naturalHeight;
  const cr = w / h;
  let dw: number, dh: number;
  if (ir > cr) {
    dh = h;
    dw = h * ir;
  } else {
    dw = w;
    dh = w / ir;
  }
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

// 타임라인 (ms)
const INTRO = 1100;
const SPIN_BASE = 1500;
const GAP = 240;
const OUTRO = 2800;

const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp01 = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : t);

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  weight = 600,
) {
  let px = startPx;
  do {
    ctx.font = `${weight} ${px}px 'Pretendard', ui-sans-serif, system-ui, sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) break;
    px -= 4;
  } while (px > 24);
  return px;
}

// 색동 스트라이프 (중앙 정렬, 정제된 4색)
function saekdongStripe(ctx: CanvasRenderingContext2D, cx: number, y: number, w: number, h: number) {
  const seg = w / OBANG.length;
  const x0 = cx - w / 2;
  OBANG.forEach((c, i) => {
    ctx.fillStyle = c;
    ctx.fillRect(x0 + i * seg, y, seg + 0.5, h);
  });
}

// 색동 리본 컨페티 — 당첨 완료시 "빵" 터지는 모션
const CONFETTI = ["#B5392E", "#2E6E6A", "#D9A441", "#C75B8A", "#5B8C5A", "#2A5C8C"];
interface Particle {
  x0: number;
  angle: number;
  speed: number;
  w: number;
  h: number;
  rot: number;
  vr: number;
  color: string;
}
function makeConfetti(n: number): Particle[] {
  let s = 20260624;
  const rnd = () => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  return Array.from({ length: n }, () => ({
    x0: CX + (rnd() - 0.5) * 140,
    angle: rnd() * Math.PI * 2,
    speed: 540 + rnd() * 1120,
    w: 9 + rnd() * 16,
    h: 4 + rnd() * 6,
    rot: rnd() * Math.PI,
    vr: (rnd() - 0.5) * 11,
    color: CONFETTI[Math.floor(rnd() * CONFETTI.length)],
  }));
}
function drawBurst(ctx: CanvasRenderingContext2D, opMs: number, parts: Particle[]) {
  const t = opMs / 1000;
  const g = 900;
  const oy = 380;
  const a = clamp01(t / 0.16);
  for (const p of parts) {
    const vx = Math.cos(p.angle) * p.speed;
    const vy = Math.sin(p.angle) * p.speed - 240; // 살짝 위로 솟았다 떨어지게
    const x = p.x0 + vx * t;
    const y = oy + vy * t + 0.5 * g * t * t;
    if (y > H + 60 || y < -60) continue;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(p.rot + p.vr * t);
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color;
    ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

interface Cfg {
  accent: string;
  handle: string;
  logo: HTMLImageElement | null;
  speed: number;
  theme: ThemeKey;
  bg: HTMLImageElement | null;
}

interface Plan {
  title: string;
  winners: string[];
  reels: string[][];
}

function buildPlan(title: string, winners: string[], pool: string[]): Plan {
  const filler = pool.length ? pool : winners;
  const reels = winners.map((w, wi) => {
    const seq: string[] = [];
    for (let i = 0; i < 22; i++) {
      seq.push(filler[(i + wi * 5 + 1) % filler.length]);
    }
    seq.push(w);
    return seq;
  });
  return { title, winners, reels };
}

const spinMs = (cfg: Cfg) => SPIN_BASE * cfg.speed;
const totalMs = (n: number, cfg: Cfg) => INTRO + n * (spinMs(cfg) + GAP) + OUTRO;

function drawFrame(ctx: CanvasRenderingContext2D, cfg: Cfg, T: Theme) {
  if (cfg.bg && cfg.bg.complete && cfg.bg.naturalWidth) {
    // 배경 사진 (cover) + 가독성 스크림
    drawCover(ctx, cfg.bg, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "rgba(18,14,10,0.30)");
    g.addColorStop(0.5, "rgba(18,14,10,0.42)");
    g.addColorStop(1, "rgba(18,14,10,0.55)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
  } else {
    ctx.fillStyle = T.bg;
    ctx.fillRect(0, 0, W, H);
  }

  // 상단 색동 스트라이프 (중앙, 정제된 모티프)
  saekdongStripe(ctx, CX, 96, 168, 6);

  // 로고 / 핸들
  if (cfg.logo && cfg.logo.complete && cfg.logo.naturalWidth) {
    const h = 64;
    const w = (cfg.logo.naturalWidth / cfg.logo.naturalHeight) * h;
    ctx.drawImage(cfg.logo, CX - w / 2, H - 168, w, h);
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  if (cfg.handle) {
    ctx.fillStyle = T.muted;
    ctx.font = "500 28px 'Pretendard', ui-sans-serif, system-ui, sans-serif";
    ctx.fillText(cfg.handle, CX, H - 78);
  }
  // 하단 얇은 헤어라인
  ctx.strokeStyle = T.hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, H - 120);
  ctx.lineTo(W - MARGIN, H - 120);
  ctx.stroke();
}

function drawHeader(ctx: CanvasRenderingContext2D, plan: Plan, cfg: Cfg, T: Theme) {
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  // 작은 대문자 라벨 (단청 레드)
  ctx.fillStyle = cfg.accent;
  ctx.font = "700 32px 'Pretendard', ui-sans-serif, system-ui, sans-serif";
  ctx.save();
  ctx.translate(CX, 160);
  // 자간 넓힌 라벨
  const label = "WINNER ANNOUNCEMENT";
  const ls = 7;
  const total = [...label].reduce((a, ch) => a + ctx.measureText(ch).width + ls, 0) - ls;
  let x = -total / 2;
  for (const ch of label) {
    const w = ctx.measureText(ch).width;
    ctx.fillText(ch, x + w / 2, 0);
    x += w + ls;
  }
  ctx.restore();
  // 이벤트명 (잉크, 타이트)
  ctx.fillStyle = T.ink;
  const tpx = fitText(ctx, plan.title, W - 2 * MARGIN, 58, 600);
  ctx.font = `600 ${tpx}px 'Pretendard', ui-sans-serif, system-ui, sans-serif`;
  ctx.fillText(plan.title, CX, 232);
}

function draw(ctx: CanvasRenderingContext2D, e: number, plan: Plan, cfg: Cfg, parts: Particle[]) {
  const T = cfg.bg ? PHOTO_THEME : THEMES[cfg.theme];
  const n = plan.winners.length;
  const spin = spinMs(cfg);
  drawFrame(ctx, cfg, T);
  drawHeader(ctx, plan, cfg, T);

  if (e < INTRO) {
    const p = clamp01(e / INTRO);
    ctx.globalAlpha = p;
    saekdongStripe(ctx, CX, H / 2 - 70, 240, 10);
    ctx.fillStyle = T.ink;
    ctx.textAlign = "center";
    ctx.font = "600 76px 'Pretendard', ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("당첨자 추첨", CX, H / 2 + 30);
    ctx.globalAlpha = 1;
    return;
  }

  const after = e - INTRO;
  const seg = spin + GAP;
  const cur = Math.min(n - 1, Math.floor(after / seg));
  const inOutro = after >= n * seg;

  if (inOutro) {
    const op = after - n * seg;
    drawBurst(ctx, op, parts);
    drawOutro(ctx, plan, clamp01(op / 600), cfg, T);
    return;
  }
  // 스핀 중에만 하단에 "결정된 당첨자" 표시 (아웃트로 그리드와 겹치지 않게)
  const decided = cur + (after - cur * seg >= spin ? 1 : 0);
  drawDecided(ctx, plan.winners.slice(0, Math.max(0, decided)), cfg, T);
  drawReel(ctx, plan.reels[cur], clamp01((after - cur * seg) / spin), cfg, T);
}

function drawReel(ctx: CanvasRenderingContext2D, seq: string[], p: number, cfg: Cfg, T: Theme) {
  const rowH = 116;
  const centerY = 600;
  const bandTop = centerY - 174;
  const bandBot = centerY + 174;
  const scroll = easeOut(p) * (seq.length - 1) * rowH;

  // 에디토리얼: 얇은 위/아래 헤어라인만 (패널 없음)
  ctx.strokeStyle = T.hair;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(MARGIN, bandTop);
  ctx.lineTo(W - MARGIN, bandTop);
  ctx.moveTo(MARGIN, bandBot);
  ctx.lineTo(W - MARGIN, bandBot);
  ctx.stroke();

  ctx.save();
  ctx.beginPath();
  ctx.rect(0, bandTop, W, bandBot - bandTop);
  ctx.clip();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const centerFloat = scroll / rowH;
  const first = Math.floor(centerFloat) - 2;
  for (let k = first; k <= first + 5; k++) {
    if (k < 0 || k >= seq.length) continue;
    const y = centerY + (k * rowH - scroll);
    const dist = Math.abs(y - centerY) / (rowH * 2);
    ctx.globalAlpha = clamp01(1 - dist) * (T.light ? 1 : 1);
    const isCenter = Math.abs(y - centerY) < rowH / 2;
    ctx.fillStyle = isCenter ? cfg.accent : T.muted;
    ctx.font = `${isCenter ? 600 : 400} ${isCenter ? 62 : 46}px 'Pretendard', ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText("@" + seq[k], CX, y);
  }
  ctx.restore();
  ctx.globalAlpha = 1;

  // 안착: 가는 단청 밑줄 + 작은 라벨
  if (p > 0.88) {
    const pop = (p - 0.88) / 0.12;
    ctx.globalAlpha = pop;
    ctx.strokeStyle = cfg.accent;
    ctx.lineWidth = 3;
    const uw = 120 * pop;
    ctx.beginPath();
    ctx.moveTo(CX - uw, centerY + 52);
    ctx.lineTo(CX + uw, centerY + 52);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }
}

function drawDecided(ctx: CanvasRenderingContext2D, names: string[], cfg: Cfg, T: Theme) {
  if (!names.length) return;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = T.muted;
  ctx.font = "500 26px 'Pretendard', ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(`결정된 당첨자 ${names.length}명`, CX, H - 230);
  const show = names.slice(-4).map((n) => "@" + n).join("   ·   ");
  ctx.fillStyle = cfg.accent;
  ctx.font = "600 30px 'Pretendard', ui-sans-serif, system-ui, sans-serif";
  ctx.fillText(show, CX, H - 188);
}

const FONT = "'Pretendard', ui-sans-serif, system-ui, sans-serif";

function drawOutro(ctx: CanvasRenderingContext2D, plan: Plan, p: number, cfg: Cfg, T: Theme) {
  ctx.globalAlpha = clamp01(p);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  saekdongStripe(ctx, CX, 296, 200, 9);
  ctx.fillStyle = T.ink;
  ctx.font = `600 70px ${FONT}`;
  ctx.fillText("당첨을 축하합니다", CX, 378);

  const ws = plan.winners;
  const n = ws.length;
  // 인원에 따라 열 수 가변 (1~4열, 열당 ~12명 목표) → 겹치지 않게
  const cols = Math.max(1, Math.min(4, Math.ceil(n / 12)));
  const rows = Math.ceil(n / cols);
  const listTop = 478;
  const listBot = H - 156;
  const rowH = Math.min(76, (listBot - listTop) / rows);
  // 인원수와 무관하게 수직 중앙 정렬 (위아래 여백 균형)
  const usedH = rows * rowH;
  const blockTop = listTop + Math.max(0, (listBot - listTop - usedH) / 2);
  const colW = (W - 2 * MARGIN) / cols;
  const baseSize = cols === 1 ? 48 : cols === 2 ? 40 : cols === 3 ? 32 : 27;

  ws.forEach((w, i) => {
    const c = Math.floor(i / rows); // 열 우선 배치 (한 열 채우고 다음 열)
    const r = i % rows;
    const colX = MARGIN + colW * (c + 0.5);
    const y = blockTop + rowH / 2 + r * rowH;
    const name = "@" + w;
    // 열 폭 안에 들어가게 폰트 축소
    let fs = Math.min(baseSize, rowH - 14);
    ctx.font = `500 ${fs}px ${FONT}`;
    while (ctx.measureText(name).width > colW - 22 && fs > 15) {
      fs -= 2;
      ctx.font = `500 ${fs}px ${FONT}`;
    }
    ctx.textAlign = "center";
    ctx.fillStyle = T.ink;
    ctx.fillText(name, colX, y);
  });
  ctx.globalAlpha = 1;
}

function pickMime() {
  const cands = [
    { type: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
    { type: "video/mp4", ext: "mp4" },
    { type: "video/webm;codecs=vp9", ext: "webm" },
    { type: "video/webm", ext: "webm" },
  ];
  for (const c of cands) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(c.type)) return c;
  }
  return { type: "video/webm", ext: "webm" };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function canvasToBlob(c: HTMLCanvasElement): Promise<Blob> {
  return new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
}

function slugify(s: string) {
  return s.replace(/[\\/:*?"<>|]/g, "").trim().slice(0, 40) || "event";
}

// ── 컴포넌트 ────────────────────────────────────────────────
export function ResultStudio({
  title,
  winners,
  pool,
}: {
  title: string;
  winners: string[];
  pool: string[];
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [busy, setBusy] = useState<null | "preview" | "record" | "zip">(null);
  const [fmt, setFmt] = useState("");
  const [images, setImages] = useState<string[]>([]);

  const [accent, setAccent] = useState("#B5392E");
  const [theme, setTheme] = useState<ThemeKey>("cream");
  const [handle, setHandle] = useState("");
  const [speedKey, setSpeedKey] = useState<"fast" | "normal" | "slow">("normal");
  const logoRef = useRef<HTMLImageElement | null>(null);
  const bgRef = useRef<HTMLImageElement | null>(null);
  const [hasBg, setHasBg] = useState(false);
  const [, force] = useState(0);

  const speed = speedKey === "fast" ? 0.7 : speedKey === "slow" ? 1.4 : 1;
  const cfg: Cfg = { accent, handle, logo: logoRef.current, speed, theme, bg: bgRef.current };

  const plan = useMemo(() => buildPlan(title, winners, pool), [title, winners, pool]);
  const parts = useMemo(() => makeConfetti(160), []);
  const total = totalMs(winners.length, cfg);

  function play(ctx: CanvasRenderingContext2D): Promise<void> {
    return new Promise((res) => {
      const start = performance.now();
      const loop = (now: number) => {
        const e = now - start;
        draw(ctx, e, plan, cfg, parts);
        if (e >= total) return res();
        requestAnimationFrame(loop);
      };
      requestAnimationFrame(loop);
    });
  }

  async function ensureFont() {
    try {
      await document.fonts.load("600 60px Pretendard");
      await document.fonts.load("500 46px Pretendard");
      await document.fonts.ready;
    } catch {
      /* 폰트 로드 실패 시 기본 폰트로 진행 */
    }
  }

  async function onPreview() {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || busy) return;
    setBusy("preview");
    await ensureFont();
    await play(ctx);
    setBusy(null);
  }

  // 영상을 녹화해 Blob 으로 반환 (다운로드는 호출부에서)
  async function recordVideo(): Promise<{ blob: Blob; ext: string } | null> {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return null;
    if (typeof MediaRecorder === "undefined") {
      alert("이 브라우저는 영상 녹화를 지원하지 않습니다. 크롬 최신 버전을 권장합니다.");
      return null;
    }
    const mime = pickMime();
    setFmt(mime.ext.toUpperCase());
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: mime.type, videoBitsPerSecond: 8_000_000 });
    const chunks: BlobPart[] = [];
    rec.ondataavailable = (ev) => ev.data.size && chunks.push(ev.data);
    const stopped = new Promise<void>((res) => (rec.onstop = () => res()));
    rec.start();
    await play(ctx);
    rec.stop();
    await stopped;
    return { blob: new Blob(chunks, { type: mime.type }), ext: mime.ext };
  }

  async function onRecord() {
    if (busy) return;
    setBusy("record");
    await ensureFont();
    const r = await recordVideo();
    if (r) downloadBlob(r.blob, `${slugify(title)}-추첨영상.${r.ext}`);
    setBusy(null);
  }

  function readImage(file: File, onReady: (img: HTMLImageElement) => void) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        onReady(img);
        force((n) => n + 1);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  }

  function onLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) readImage(file, (img) => (logoRef.current = img));
  }

  function onBg(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file)
      readImage(file, (img) => {
        bgRef.current = img;
        setHasBg(true);
      });
  }

  function clearBg() {
    bgRef.current = null;
    setHasBg(false);
  }

  function renderCardCanvas(
    drawCard: (ctx: CanvasRenderingContext2D, T: Theme) => void,
  ): HTMLCanvasElement {
    const T = cfg.bg ? PHOTO_THEME : THEMES[cfg.theme];
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d")!;
    drawFrame(ctx, cfg, T);
    drawCard(ctx, T);
    return c;
  }

  // 캐러셀 카드 그리기 콜백 목록 (0번 = 커버, 이후 = 당첨자 페이지)
  function cardDrawers(): Array<(ctx: CanvasRenderingContext2D, T: Theme) => void> {
    const drawers: Array<(ctx: CanvasRenderingContext2D, T: Theme) => void> = [];
    // 커버
    drawers.push((ctx, T) => {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      saekdongStripe(ctx, CX, H / 2 - 150, 220, 10);
      ctx.fillStyle = accent;
      ctx.font = "600 28px 'Pretendard', ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("WINNER ANNOUNCEMENT", CX, H / 2 - 80);
      ctx.fillStyle = T.ink;
      const px = fitText(ctx, title, W - 2 * MARGIN, 64, 600);
      ctx.font = `600 ${px}px 'Pretendard', ui-sans-serif, system-ui, sans-serif`;
      ctx.fillText(title, CX, H / 2 + 10);
      ctx.fillStyle = accent;
      ctx.font = "600 80px 'Pretendard', ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("당첨자 발표", CX, H / 2 + 120);
      ctx.fillStyle = T.muted;
      ctx.font = "400 38px 'Pretendard', ui-sans-serif, system-ui, sans-serif";
      ctx.fillText(`총 ${winners.length}명`, CX, H / 2 + 210);
    });
    const per = 6;
    for (let i = 0; i < winners.length; i += per) {
      const chunk = winners.slice(i, i + per);
      const page = Math.floor(i / per) + 1;
      const pages = Math.ceil(winners.length / per);
      drawers.push((ctx, T) => {
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = accent;
        ctx.font = "600 30px 'Pretendard', ui-sans-serif, system-ui, sans-serif";
        ctx.fillText(pages > 1 ? `당첨자 ${page} / ${pages}` : "당첨자", CX, 320);
        const startY = 440;
        const rowH = 130;
        chunk.forEach((w, k) => {
          const y = startY + k * rowH;
          ctx.strokeStyle = T.hair;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(MARGIN, y + rowH / 2);
          ctx.lineTo(W - MARGIN, y + rowH / 2);
          ctx.stroke();
          ctx.textAlign = "left";
          ctx.fillStyle = accent;
          ctx.font = "600 36px 'Pretendard', ui-sans-serif, system-ui, sans-serif";
          ctx.fillText(`${i + k + 1}`, MARGIN, y);
          ctx.textAlign = "center";
          ctx.fillStyle = T.ink;
          ctx.font = "500 52px 'Pretendard', ui-sans-serif, system-ui, sans-serif";
          ctx.fillText("@" + w, CX, y);
        });
      });
    }
    return drawers;
  }

  function onCarousel() {
    setImages(cardDrawers().map((d) => renderCardCanvas(d).toDataURL("image/png")));
  }

  // 커버 → 추첨영상 → 카드1~끝 순서로 번호 붙여 ZIP 한 번에 다운로드
  async function onDownloadAll() {
    if (busy) return;
    setBusy("zip");
    await ensureFont();
    const video = await recordVideo(); // 보이는 캔버스로 영상 녹화
    const drawers = cardDrawers();
    const cardBlobs = await Promise.all(
      drawers.map((d) => canvasToBlob(renderCardCanvas(d))),
    );
    setImages(drawers.map((d) => renderCardCanvas(d).toDataURL("image/png")));

    const zip = new JSZip();
    const pad = (n: number) => String(n).padStart(2, "0");
    let idx = 1;
    zip.file(`${pad(idx++)}_커버.png`, cardBlobs[0]); // 01 커버
    if (video) zip.file(`${pad(idx++)}_추첨영상.${video.ext}`, video.blob); // 02 영상
    for (let i = 1; i < cardBlobs.length; i++) {
      zip.file(`${pad(idx++)}_카드${i}.png`, cardBlobs[i]); // 03~ 카드
    }
    const out = await zip.generateAsync({ type: "blob" });
    downloadBlob(out, `${slugify(title)}-인스타-업로드.zip`);
    setBusy(null);
  }

  const btn =
    "h-11 rounded-full px-5 text-[15px] font-semibold transition active:scale-[0.96] disabled:opacity-50";
  const ctrl =
    "h-10 rounded-xl border border-ep-hairline bg-ep-field px-3 text-sm text-ep-ink outline-none focus:border-ep-accent";

  return (
    <div className="flex flex-col gap-6">
      {/* 브랜드 컨트롤 */}
      <div className="grid grid-cols-2 gap-3 rounded-2xl border border-ep-hairline p-4 sm:grid-cols-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ep-ink-muted">테마 {hasBg && "(배경사진 우선)"}</span>
          <select value={theme} onChange={(e) => setTheme(e.target.value as ThemeKey)} className={ctrl}>
            <option value="cream">흰색</option>
            <option value="dark">다크</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ep-ink-muted">액센트</span>
          <input
            type="color"
            value={accent}
            onChange={(e) => setAccent(e.target.value)}
            className="h-10 w-full rounded-xl border border-ep-hairline"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ep-ink-muted">핸들/문구</span>
          <input value={handle} onChange={(e) => setHandle(e.target.value)} placeholder="@saekdong.co.kr" className={ctrl} />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ep-ink-muted">속도</span>
          <select value={speedKey} onChange={(e) => setSpeedKey(e.target.value as "fast" | "normal" | "slow")} className={ctrl}>
            <option value="fast">빠름</option>
            <option value="normal">보통</option>
            <option value="slow">느림</option>
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs text-ep-ink-muted">로고 (PNG)</span>
          <input type="file" accept="image/*" onChange={onLogo} className="text-xs text-ep-ink-muted" />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-ep-ink-muted">
            배경 이미지{" "}
            {hasBg && (
              <button type="button" onClick={clearBg} className="text-ep-accent underline underline-offset-2">
                지우기
              </button>
            )}
          </span>
          <input type="file" accept="image/*" onChange={onBg} className="text-xs text-ep-ink-muted" />
        </div>
      </div>

      {/* 영상 */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-ep-ink-muted">추첨 영상 (슬롯머신 · 4:5 세로)</h3>
        <canvas
          ref={canvasRef}
          width={W}
          height={H}
          className="w-full max-w-[360px] self-center rounded-2xl border border-ep-hairline"
        />
        <div className="flex flex-wrap gap-2">
          <button onClick={onPreview} disabled={!!busy} className={`${btn} border border-ep-hairline text-ep-ink`}>
            {busy === "preview" ? "재생 중…" : "미리보기"}
          </button>
          <button onClick={onRecord} disabled={!!busy} className={`${btn} bg-ep-accent text-ep-on-accent`}>
            {busy === "record" ? "녹화 중… (끝까지 대기)" : "영상 다운로드"}
          </button>
          {fmt && <span className="self-center text-xs text-ep-ink-faint">{fmt} 저장</span>}
        </div>
        <p className="text-xs text-ep-ink-faint">
          ※ 크롬 최신 버전 권장(MP4 녹화). 배경·액센트·로고를 바꾸면 미리보기로 확인 후 다운로드하세요.
        </p>
      </div>

      <div className="h-px bg-ep-hairline" />

      {/* 캐러셀 */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold text-ep-ink-muted">당첨자 캐러셀 이미지 (1080×1350 · 4:5)</h3>
        <button onClick={onCarousel} className={`${btn} self-start border border-ep-hairline text-ep-ink`}>
          캐러셀 생성
        </button>
        {images.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {images.map((src, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt={`카드 ${i + 1}`} className="w-full rounded-xl border border-ep-hairline" />
                <a
                  href={src}
                  download={`${slugify(title)}-당첨자-${i + 1}.png`}
                  className="rounded-lg bg-ep-canvas py-1.5 text-center text-xs font-medium text-ep-ink-muted"
                >
                  {i === 0 ? "커버" : `카드 ${i}`} 다운로드
                </a>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="h-px bg-ep-hairline" />

      {/* 전체 다운로드 (ZIP) */}
      <div className="flex flex-col gap-2 rounded-2xl border border-ep-hairline bg-ep-accent-soft p-4">
        <h3 className="text-sm font-semibold text-ep-ink">한 번에 다운로드 (인스타 업로드용)</h3>
        <p className="text-xs text-ep-ink-muted">
          <b>커버 → 추첨영상 → 카드</b> 순서로 번호가 붙은 ZIP으로 저장됩니다. 압축을 풀고
          파일명 순서대로(01, 02, 03…) 인스타에 올리면 돼요.
        </p>
        <button
          onClick={onDownloadAll}
          disabled={!!busy}
          className={`${btn} self-start bg-ep-accent text-ep-on-accent`}
        >
          {busy === "zip" ? "묶는 중… (영상 녹화 포함, 잠시 대기)" : "전체 다운로드 (ZIP)"}
        </button>
      </div>
    </div>
  );
}
