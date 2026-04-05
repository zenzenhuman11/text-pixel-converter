import { useState, useRef, useEffect } from "react";
import "./App.css";

/* ─── 音韻テーブル ─── */

// 調音位置 → 色相 (0–360)
const PLACE = {
  bilabial: 0,      // 唇音: ま・ぱ・ば → 赤
  alveolar: 60,     // 歯茎音: た・な・さ → 黄
  postalveolar: 120, // 後部歯茎: し・ち・じ → 緑
  palatal: 180,     // 硬口蓋: や → シアン
  velar: 240,       // 軟口蓋: か・が → 青
  glottal: 300,     // 声門: は → マゼンタ
  vowel: null,      // 母音は別処理
};

// 調音方法 → ソノリティ (0–1, 高いほど響く)
const MANNER = {
  stop: 0.15,       // 破裂音
  affricate: 0.25,  // 破擦音
  fricative: 0.35,  // 摩擦音
  liquid: 0.6,      // 流音・弾き音
  nasal: 0.75,      // 鼻音
  glide: 0.85,      // 半母音
  vowel: 1.0,       // 母音
};

// 母音の特徴: [前後 0=前–1=後, 開口度 0=閉–1=開]
const VOWELS = {
  a: [0.5, 1.0],
  i: [0.0, 0.0],
  u: [1.0, 0.0],
  e: [0.0, 0.5],
  o: [1.0, 0.5],
};

// 五十音 → 音韻素性マッピング
const PHONEME_MAP = {};

function def(chars, place, manner, voiced, vowelKey) {
  for (const ch of chars) {
    PHONEME_MAP[ch] = { place, manner, voiced, vowel: vowelKey };
  }
}

// 母音行
def("あいうえお", "vowel", "vowel", true, null);
// 特殊: 個別に母音を設定
PHONEME_MAP["あ"] = { place: "vowel", manner: "vowel", voiced: true, vowel: "a" };
PHONEME_MAP["い"] = { place: "vowel", manner: "vowel", voiced: true, vowel: "i" };
PHONEME_MAP["う"] = { place: "vowel", manner: "vowel", voiced: true, vowel: "u" };
PHONEME_MAP["え"] = { place: "vowel", manner: "vowel", voiced: true, vowel: "e" };
PHONEME_MAP["お"] = { place: "vowel", manner: "vowel", voiced: true, vowel: "o" };

// か行 (軟口蓋・破裂)
def("か", "velar", "stop", false, "a");
def("き", "velar", "stop", false, "i");
def("く", "velar", "stop", false, "u");
def("け", "velar", "stop", false, "e");
def("こ", "velar", "stop", false, "o");
def("が", "velar", "stop", true, "a");
def("ぎ", "velar", "stop", true, "i");
def("ぐ", "velar", "stop", true, "u");
def("げ", "velar", "stop", true, "e");
def("ご", "velar", "stop", true, "o");

// さ行 (歯茎・摩擦)
def("さ", "alveolar", "fricative", false, "a");
def("し", "postalveolar", "fricative", false, "i");
def("す", "alveolar", "fricative", false, "u");
def("せ", "alveolar", "fricative", false, "e");
def("そ", "alveolar", "fricative", false, "o");
def("ざ", "alveolar", "fricative", true, "a");
def("じ", "postalveolar", "fricative", true, "i");
def("ず", "alveolar", "fricative", true, "u");
def("ぜ", "alveolar", "fricative", true, "e");
def("ぞ", "alveolar", "fricative", true, "o");

// た行 (歯茎・破裂)
def("た", "alveolar", "stop", false, "a");
def("ち", "postalveolar", "affricate", false, "i");
def("つ", "alveolar", "affricate", false, "u");
def("て", "alveolar", "stop", false, "e");
def("と", "alveolar", "stop", false, "o");
def("だ", "alveolar", "stop", true, "a");
def("ぢ", "postalveolar", "affricate", true, "i");
def("づ", "alveolar", "affricate", true, "u");
def("で", "alveolar", "stop", true, "e");
def("ど", "alveolar", "stop", true, "o");

// な行 (歯茎・鼻音)
def("な", "alveolar", "nasal", true, "a");
def("に", "palatal", "nasal", true, "i");
def("ぬ", "alveolar", "nasal", true, "u");
def("ね", "alveolar", "nasal", true, "e");
def("の", "alveolar", "nasal", true, "o");

// は行 (声門・摩擦)
def("は", "glottal", "fricative", false, "a");
def("ひ", "palatal", "fricative", false, "i");
def("ふ", "bilabial", "fricative", false, "u");
def("へ", "glottal", "fricative", false, "e");
def("ほ", "glottal", "fricative", false, "o");
def("ば", "bilabial", "stop", true, "a");
def("び", "bilabial", "stop", true, "i");
def("ぶ", "bilabial", "stop", true, "u");
def("べ", "bilabial", "stop", true, "e");
def("ぼ", "bilabial", "stop", true, "o");
def("ぱ", "bilabial", "stop", false, "a");
def("ぴ", "bilabial", "stop", false, "i");
def("ぷ", "bilabial", "stop", false, "u");
def("ぺ", "bilabial", "stop", false, "e");
def("ぽ", "bilabial", "stop", false, "o");

// ま行 (唇・鼻音)
def("ま", "bilabial", "nasal", true, "a");
def("み", "bilabial", "nasal", true, "i");
def("む", "bilabial", "nasal", true, "u");
def("め", "bilabial", "nasal", true, "e");
def("も", "bilabial", "nasal", true, "o");

// や行 (口蓋・半母音)
def("や", "palatal", "glide", true, "a");
def("ゆ", "palatal", "glide", true, "u");
def("よ", "palatal", "glide", true, "o");

// ら行 (歯茎・流音)
def("ら", "alveolar", "liquid", true, "a");
def("り", "alveolar", "liquid", true, "i");
def("る", "alveolar", "liquid", true, "u");
def("れ", "alveolar", "liquid", true, "e");
def("ろ", "alveolar", "liquid", true, "o");

// わ行 (唇・半母音)
def("わ", "bilabial", "glide", true, "a");
def("を", "bilabial", "glide", true, "o");

// 特殊モーラ
PHONEME_MAP["ん"] = { place: "alveolar", manner: "nasal", voiced: true, vowel: null, special: "moraic_nasal" };
PHONEME_MAP["っ"] = { place: null, manner: "stop", voiced: false, vowel: null, special: "geminate" };
PHONEME_MAP["ー"] = { place: null, manner: "vowel", voiced: true, vowel: null, special: "long" };

// カタカナも同じマッピングに (ひらがなとの差分: 0x60)
for (const [hira, info] of Object.entries(PHONEME_MAP)) {
  const cp = hira.codePointAt(0);
  if (cp >= 0x3040 && cp <= 0x309F) {
    const kata = String.fromCodePoint(cp + 0x60);
    PHONEME_MAP[kata] = info;
  }
}

// ローマ字の簡易マッピング
const ROMAJI = {
  a: { place: "vowel", manner: "vowel", voiced: true, vowel: "a" },
  i: { place: "vowel", manner: "vowel", voiced: true, vowel: "i" },
  u: { place: "vowel", manner: "vowel", voiced: true, vowel: "u" },
  e: { place: "vowel", manner: "vowel", voiced: true, vowel: "e" },
  o: { place: "vowel", manner: "vowel", voiced: true, vowel: "o" },
  k: { place: "velar", manner: "stop", voiced: false, vowel: null },
  g: { place: "velar", manner: "stop", voiced: true, vowel: null },
  s: { place: "alveolar", manner: "fricative", voiced: false, vowel: null },
  z: { place: "alveolar", manner: "fricative", voiced: true, vowel: null },
  t: { place: "alveolar", manner: "stop", voiced: false, vowel: null },
  d: { place: "alveolar", manner: "stop", voiced: true, vowel: null },
  n: { place: "alveolar", manner: "nasal", voiced: true, vowel: null },
  h: { place: "glottal", manner: "fricative", voiced: false, vowel: null },
  b: { place: "bilabial", manner: "stop", voiced: true, vowel: null },
  p: { place: "bilabial", manner: "stop", voiced: false, vowel: null },
  m: { place: "bilabial", manner: "nasal", voiced: true, vowel: null },
  y: { place: "palatal", manner: "glide", voiced: true, vowel: null },
  r: { place: "alveolar", manner: "liquid", voiced: true, vowel: null },
  l: { place: "alveolar", manner: "liquid", voiced: true, vowel: null },
  w: { place: "bilabial", manner: "glide", voiced: true, vowel: null },
  f: { place: "bilabial", manner: "fricative", voiced: false, vowel: null },
  v: { place: "bilabial", manner: "fricative", voiced: true, vowel: null },
  j: { place: "postalveolar", manner: "affricate", voiced: true, vowel: null },
  c: { place: "velar", manner: "stop", voiced: false, vowel: null },
  x: { place: "velar", manner: "fricative", voiced: false, vowel: null },
  q: { place: "velar", manner: "stop", voiced: false, vowel: null },
};

// 大文字も対応
for (const [ch, info] of Object.entries(ROMAJI)) {
  PHONEME_MAP[ch] = info;
  PHONEME_MAP[ch.toUpperCase()] = info;
}

/* ─── 色変換 ─── */

function hslToRgb(h, s, l) {
  let r, g, b;
  if (s === 0) { r = g = b = l; }
  else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1; if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    const q2 = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p2 = 2 * l - q2;
    r = hue2rgb(p2, q2, h + 1/3);
    g = hue2rgb(p2, q2, h);
    b = hue2rgb(p2, q2, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function charToColor(ch) {
  const info = PHONEME_MAP[ch];

  // マッピングにない文字 → グレー（記号・句読点・数字など）
  if (!info) {
    const cp = ch.codePointAt(0);
    if (cp <= 32) return [30, 30, 30, 40]; // 空白系
    return [80, 80, 80, 180]; // 記号・句読点
  }

  // 特殊モーラ
  if (info.special === "geminate") return [20, 20, 20, 255];    // 促音 → ほぼ黒（沈黙の圧縮）
  if (info.special === "moraic_nasal") return [...hslToRgb(45/360, 0.4, 0.45), 255]; // ん → 暖かい暗色
  if (info.special === "long") return [200, 200, 220, 120];     // 長音 → 淡く透明

  // 色相: 調音位置（子音）or 母音の前後位置
  let hue;
  if (info.place === "vowel" && info.vowel) {
    const [front, _open] = VOWELS[info.vowel];
    hue = front * 270 + 20; // 前舌(い)=20° → 後舌(う)=290°
  } else if (info.place && PLACE[info.place] !== undefined && PLACE[info.place] !== null) {
    hue = PLACE[info.place];
    // 母音で色相を微調整（同じ子音でも母音で表情が変わる）
    if (info.vowel && VOWELS[info.vowel]) {
      const [front] = VOWELS[info.vowel];
      hue += (front - 0.5) * 30;
    }
  } else {
    hue = 0;
  }

  // 彩度: ソノリティ（響く音ほど鮮やか）
  const sonority = MANNER[info.manner] || 0.5;
  const saturation = 0.3 + sonority * 0.6; // 0.3–0.9

  // 明度: 母音の開口度（開→明るい、閉→暗い）
  let lightness = 0.45;
  if (info.vowel && VOWELS[info.vowel]) {
    const [, openness] = VOWELS[info.vowel];
    lightness = 0.3 + openness * 0.35; // 0.3–0.65
  }

  // 透明度: 有声/無声（有声=不透明、無声=やや透明）
  const alpha = info.voiced ? 255 : 200;

  return [...hslToRgb(((hue % 360) + 360) % 360 / 360, saturation, lightness), alpha];
}

/* ─── 凡例データ ─── */

const LEGEND_ITEMS = [
  { label: "色相 = 調音位置", items: [
    { color: hslToRgb(0/360, 0.7, 0.5), text: "唇音 (ま・ぱ・ば)" },
    { color: hslToRgb(60/360, 0.7, 0.5), text: "歯茎音 (た・な・さ)" },
    { color: hslToRgb(120/360, 0.7, 0.5), text: "後部歯茎 (し・ち)" },
    { color: hslToRgb(180/360, 0.7, 0.5), text: "硬口蓋 (や・に)" },
    { color: hslToRgb(240/360, 0.7, 0.5), text: "軟口蓋 (か・が)" },
    { color: hslToRgb(300/360, 0.7, 0.5), text: "声門 (は・へ・ほ)" },
  ]},
  { label: "彩度 = ソノリティ", items: [
    { color: hslToRgb(60/360, 0.3, 0.5), text: "低：破裂音 (か・た)" },
    { color: hslToRgb(60/360, 0.9, 0.5), text: "高：母音・鼻音 (あ・な)" },
  ]},
  { label: "明度 = 開口度", items: [
    { color: hslToRgb(60/360, 0.7, 0.3), text: "閉：い・う段" },
    { color: hslToRgb(60/360, 0.7, 0.65), text: "開：あ段" },
  ]},
  { label: "透明度 = 有声/無声", items: [
    { color: hslToRgb(240/360, 0.7, 0.5), text: "不透明：有声 (が)" },
    { color: hslToRgb(240/360, 0.7, 0.5), text: "半透明：無声 (か)", alpha: 200 },
  ]},
];

/* ─── App ─── */

export default function App() {
  const [text, setText] = useState("ことばの音には色がある。静かな鼻音は深く響き、鋭い破裂音は閃光のように走る。");
  const [pixelSize, setPixelSize] = useState(8);
  const [info, setInfo] = useState("");
  const [hoveredChar, setHoveredChar] = useState(null);
  const canvasRef = useRef(null);
  const charsRef = useRef([]);
  const colsRef = useRef(0);

  const render = () => {
    const chars = [...text].filter(c => c !== "\n");
    charsRef.current = chars;
    if (!chars.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const cols = Math.ceil(Math.sqrt(chars.length * 1.6));
    colsRef.current = cols;
    const rows = Math.ceil(chars.length / cols);
    canvas.width = cols * pixelSize;
    canvas.height = rows * pixelSize;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    chars.forEach((ch, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const [r, g, b, a] = charToColor(ch);
      ctx.fillStyle = `rgba(${r},${g},${b},${a/255})`;
      ctx.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
    });
    setInfo(`${chars.length} 文字 → ${cols}×${rows} px`);
  };

  useEffect(() => { render(); }, [text, pixelSize]);

  const handleCanvasHover = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    const col = Math.floor(x / pixelSize);
    const row = Math.floor(y / pixelSize);
    const idx = row * colsRef.current + col;
    if (idx >= 0 && idx < charsRef.current.length) {
      const ch = charsRef.current[idx];
      const phoneme = PHONEME_MAP[ch];
      if (phoneme) {
        const placeLabel = phoneme.place || "—";
        const mannerLabel = phoneme.manner || "—";
        const voiceLabel = phoneme.voiced ? "有声" : "無声";
        const vowelLabel = phoneme.vowel || "—";
        setHoveredChar(`「${ch}」 ${placeLabel} / ${mannerLabel} / ${voiceLabel} / 母音:${vowelLabel}`);
      } else {
        setHoveredChar(`「${ch}」 記号・句読点`);
      }
    }
  };

  const save = () => {
    const link = document.createElement("a");
    link.download = "phoneme_pixels.png";
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <div className="app">
      <header>
        <h1>音色 → 色彩</h1>
        <p>文字の音韻を多次元の色にマッピングする</p>
      </header>
      <main>
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="テキストを入力..."
          rows={4}
        />
        <div className="controls">
          <div className="control-group">
            <label>ピクセルサイズ: {pixelSize}px</label>
            <input
              type="range" min={2} max={32} step={2}
              value={pixelSize}
              onChange={e => setPixelSize(Number(e.target.value))}
            />
          </div>
        </div>
        <div className="canvas-wrap">
          <canvas
            ref={canvasRef}
            onMouseMove={handleCanvasHover}
            onMouseLeave={() => setHoveredChar(null)}
          />
        </div>
        <div className="footer-row">
          <span className="info">{hoveredChar || info}</span>
          <button className="save-btn" onClick={save}>PNG保存</button>
        </div>
        <div className="desc">
          <p>各文字の発音を音声学的に分析し、4つの次元で色にマッピングします。</p>
        </div>
        <div className="legend">
          {LEGEND_ITEMS.map((group) => (
            <div key={group.label} className="legend-group">
              <div className="legend-title">{group.label}</div>
              <div className="legend-entries">
                {group.items.map((item, i) => (
                  <div key={i} className="legend-entry">
                    <span
                      className="legend-swatch"
                      style={{
                        background: `rgba(${item.color[0]},${item.color[1]},${item.color[2]},${(item.alpha ?? 255)/255})`,
                      }}
                    />
                    <span className="legend-text">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
