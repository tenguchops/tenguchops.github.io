const audio = document.getElementById("audio");
const playBtn = document.getElementById("playBtn");
const stopBtn = document.getElementById("stopBtn");
const seek = document.getElementById("seek");
const vol = document.getElementById("vol");
const cur = document.getElementById("cur");
const dur = document.getElementById("dur");

const canvas = document.getElementById("viz");
const ctx = canvas.getContext("2d", { alpha: true });

let ac = null;         // AudioContext
let analyser = null;   // AnalyserNode
let data = null;       // Uint8Array
let srcNode = null;
let rafId = null;

function resize(){
  const dpr = window.devicePixelRatio || 1;
  canvas.width  = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = "100%";
  canvas.style.height = "100%";
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
window.addEventListener("resize", resize);
resize();

function fmtTime(sec){
  if (!isFinite(sec)) return "0:00";
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${String(s).padStart(2,"0")}`;
}

function ensureAudioGraph(){
  if (ac) return;

  ac = new (window.AudioContext || window.webkitAudioContext)();
  analyser = ac.createAnalyser();
  analyser.fftSize = 1024;
  analyser.smoothingTimeConstant = 0.85;

  // audio要素 -> analyser -> destination
  srcNode = ac.createMediaElementSource(audio);
  srcNode.connect(analyser);
  analyser.connect(ac.destination);

  data = new Uint8Array(analyser.frequencyBinCount);
}

function draw(){
  rafId = requestAnimationFrame(draw);

  const w = window.innerWidth;
  const h = window.innerHeight;

  // 背景をうっすらクリア（残像）
  ctx.fillStyle = "rgba(7,11,16,0.12)";
  ctx.fillRect(0,0,w,h);

  if (!analyser || !data) {
    // 未再生でもそれっぽく
    glow(0.15);
    return;
  }

  analyser.getByteFrequencyData(data);

  // 低域〜中域をざっくり平均
  const n = data.length;
  let low = 0, mid = 0;
  for (let i=0;i<n;i++){
    const v = data[i] / 255;
    if (i < n*0.18) low += v;
    else if (i < n*0.55) mid += v;
  }
  low /= Math.max(1, Math.floor(n*0.18));
  mid /= Math.max(1, Math.floor(n*0.37));

  const energy = clamp((low*1.2 + mid*0.8) / 2, 0, 1);

  glow(energy);

  // 波形風リング
  ring(energy, data);
}

function glow(energy){
  const w = window.innerWidth;
  const h = window.innerHeight;

  const r1 = 220 + energy * 260;
  const r2 = 180 + energy * 240;

  const g1 = ctx.createRadialGradient(w*0.25, h*0.25, 0, w*0.25, h*0.25, r1);
  g1.addColorStop(0, `rgba(125,211,252,${0.22 + energy*0.35})`);
  g1.addColorStop(1, "rgba(125,211,252,0)");
  ctx.fillStyle = g1;
  ctx.fillRect(0,0,w,h);

  const g2 = ctx.createRadialGradient(w*0.75, h*0.75, 0, w*0.75, h*0.75, r2);
  g2.addColorStop(0, `rgba(167,139,250,${0.18 + energy*0.32})`);
  g2.addColorStop(1, "rgba(167,139,250,0)");
  ctx.fillStyle = g2;
  ctx.fillRect(0,0,w,h);
}

function ring(energy, freq){
  const w = window.innerWidth;
  const h = window.innerHeight;
  const cx = w*0.5;
  const cy = h*0.58;

  const base = 80 + energy*140;
  const bins = 180;
  const step = Math.floor(freq.length / bins);

  ctx.save();
  ctx.translate(cx, cy);

  ctx.beginPath();
  for (let i=0;i<bins;i++){
    const a = (i / bins) * Math.PI * 2;
    const idx = i * step;
    const v = (freq[idx] / 255);
    const bump = v * (18 + energy*45);
    const r = base + bump;

    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x,y);
    else ctx.lineTo(x,y);
  }
  ctx.closePath();

  ctx.lineWidth = 2;
  ctx.strokeStyle = `rgba(232,238,246,${0.10 + energy*0.25})`;
  ctx.stroke();

  ctx.restore();
}

function clamp(v,min,max){ return Math.max(min, Math.min(max, v)); }

// UI
vol.addEventListener("input", () => {
  audio.volume = Number(vol.value);
});
audio.volume = Number(vol.value);

playBtn.addEventListener("click", async () => {
  ensureAudioGraph();
  if (ac.state === "suspended") await ac.resume();

  if (audio.paused) {
    await audio.play();
    playBtn.textContent = "Pause";
  } else {
    audio.pause();
    playBtn.textContent = "Play";
  }
});

stopBtn.addEventListener("click", () => {
  audio.pause();
  audio.currentTime = 0;
  playBtn.textContent = "Play";
});

audio.addEventListener("loadedmetadata", () => {
  dur.textContent = fmtTime(audio.duration);
});

audio.addEventListener("timeupdate", () => {
  cur.textContent = fmtTime(audio.currentTime);
  if (audio.duration) {
    const v = Math.floor((audio.currentTime / audio.duration) * 1000);
    seek.value = String(v);
  }
});

seek.addEventListener("input", () => {
  if (!audio.duration) return;
  const t = (Number(seek.value) / 1000) * audio.duration;
  audio.currentTime = t;
});

// 初期描画開始
if (!rafId) draw();