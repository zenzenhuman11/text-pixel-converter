import { useState, useRef, useEffect, useCallback } from "react";
import "./App.css";

/* ─── 研究ベースの音色マッピング ─── */

// 母音 → 基調色 [H, S, L]
// 研究知見: a=赤, i=明るい黄/白, u=暗い青, e=黄緑, o=暗い紺/黒
const VOWEL_COLORS = {
  a: [0,    0.85, 0.55],  // 赤
  i: [50,   0.80, 0.70],  // 明るい黄
  u: [220,  0.70, 0.35],  // 暗い青
  e: [95,   0.65, 0.50],  // 黄緑
  o: [250,  0.50, 0.28],  // 暗い紺
};

// 調音位置 → 色相シフト (母音の基調色からどれだけずらすか)
const PLACE_HUE_SHIFT = {
  bilabial:      -20,  // 唇音: 暖色方向へ
  alveolar:      +15,  // 歯茎音: やや冷色方向
  postalveolar:  +35,  // 後部歯茎: さらに冷色
  palatal:       +50,  // 硬口蓋: 大きくシフト
  velar:         -35,  // 軟口蓋: 暖色方向に大きく
  glottal:       +70,  // 声門: 大幅にシフト
  vowel:         0,    // 純母音: シフトなし
};

// 調音方法 → [彩度倍率, 明度シフト]
const MANNER_MOD = {
  stop:        [0.80, -0.06],  // 破裂音: くすんで暗い
  affricate:   [0.75, -0.04],  // 破擦音
  fricative:   [0.70, +0.06],  // 摩擦音: くすんで明るい
  nasal:       [1.15, +0.10],  // 鼻音: 鮮やかで明るい
  liquid:      [1.05, +0.07],  // 流音: やや鮮やか
  glide:       [1.00, +0.04],  // 半母音: ほぼ母音
  vowel:       [1.00, 0],      // 純母音
};

// 五十音 → 音韻素性マッピング
const PHONEME_MAP = {};

function def(ch, place, manner, voiced, vowelKey) {
  PHONEME_MAP[ch] = { place, manner, voiced, vowel: vowelKey };
}

// 母音行
def("あ", "vowel", "vowel", true, "a");
def("い", "vowel", "vowel", true, "i");
def("う", "vowel", "vowel", true, "u");
def("え", "vowel", "vowel", true, "e");
def("お", "vowel", "vowel", true, "o");

// か行
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

// さ行
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

// た行
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

// な行
def("な", "alveolar", "nasal", true, "a");
def("に", "palatal", "nasal", true, "i");
def("ぬ", "alveolar", "nasal", true, "u");
def("ね", "alveolar", "nasal", true, "e");
def("の", "alveolar", "nasal", true, "o");

// は行
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

// ま行
def("ま", "bilabial", "nasal", true, "a");
def("み", "bilabial", "nasal", true, "i");
def("む", "bilabial", "nasal", true, "u");
def("め", "bilabial", "nasal", true, "e");
def("も", "bilabial", "nasal", true, "o");

// や行
def("や", "palatal", "glide", true, "a");
def("ゆ", "palatal", "glide", true, "u");
def("よ", "palatal", "glide", true, "o");

// ら行
def("ら", "alveolar", "liquid", true, "a");
def("り", "alveolar", "liquid", true, "i");
def("る", "alveolar", "liquid", true, "u");
def("れ", "alveolar", "liquid", true, "e");
def("ろ", "alveolar", "liquid", true, "o");

// わ行
def("わ", "bilabial", "glide", true, "a");
def("を", "bilabial", "glide", true, "o");

// 特殊モーラ
PHONEME_MAP["ん"] = { place: "alveolar", manner: "nasal", voiced: true, vowel: null, special: "moraic_nasal" };
PHONEME_MAP["っ"] = { place: null, manner: "stop", voiced: false, vowel: null, special: "geminate" };
PHONEME_MAP["ー"] = { place: null, manner: "vowel", voiced: true, vowel: null, special: "long" };

// カタカナも同じマッピングに (ひらがなとの差分: 0x60)
for (const [hira, info] of Object.entries({ ...PHONEME_MAP })) {
  const cp = hira.codePointAt(0);
  if (cp >= 0x3040 && cp <= 0x309F) {
    PHONEME_MAP[String.fromCodePoint(cp + 0x60)] = info;
  }
}

// ローマ字の簡易マッピング
const ROMAJI_MAP = {
  a: ["vowel", "vowel", true, "a"],
  i: ["vowel", "vowel", true, "i"],
  u: ["vowel", "vowel", true, "u"],
  e: ["vowel", "vowel", true, "e"],
  o: ["vowel", "vowel", true, "o"],
  k: ["velar", "stop", false, null],
  g: ["velar", "stop", true, null],
  s: ["alveolar", "fricative", false, null],
  z: ["alveolar", "fricative", true, null],
  t: ["alveolar", "stop", false, null],
  d: ["alveolar", "stop", true, null],
  n: ["alveolar", "nasal", true, null],
  h: ["glottal", "fricative", false, null],
  b: ["bilabial", "stop", true, null],
  p: ["bilabial", "stop", false, null],
  m: ["bilabial", "nasal", true, null],
  y: ["palatal", "glide", true, null],
  r: ["alveolar", "liquid", true, null],
  l: ["alveolar", "liquid", true, null],
  w: ["bilabial", "glide", true, null],
  f: ["bilabial", "fricative", false, null],
  v: ["bilabial", "fricative", true, null],
  j: ["postalveolar", "affricate", true, null],
  c: ["velar", "stop", false, null],
  x: ["velar", "fricative", false, null],
  q: ["velar", "stop", false, null],
};
for (const [ch, [place, manner, voiced, vowel]] of Object.entries(ROMAJI_MAP)) {
  PHONEME_MAP[ch] = { place, manner, voiced, vowel };
  PHONEME_MAP[ch.toUpperCase()] = { place, manner, voiced, vowel };
}

/* ─── カタカナ→ひらがな変換 ─── */

function kataToHira(str) {
  return str.replace(/[\u30A0-\u30FF]/g, (ch) =>
    String.fromCodePoint(ch.codePointAt(0) - 0x60)
  );
}

/* ─── 漢字→読み変換 (kuromoji) ─── */

function textToReadings(tokens, text) {
  const chars = [...text];
  const readingMap = new Array(chars.length).fill(null);

  for (const token of tokens) {
    const surface = token.surface_form;
    const reading = token.reading;
    const start = token.word_position - 1;

    if (!reading || reading === "*") {
      // 読みなし: そのまま
      [...surface].forEach((ch, i) => {
        const pos = start + i;
        if (pos < readingMap.length) readingMap[pos] = [ch];
      });
      continue;
    }

    const hiraReading = kataToHira(reading);
    const surfaceChars = [...surface];
    const readingChars = [...hiraReading];

    // 全て非漢字（ひらがな/カタカナ）の場合: 1対1で割り当て
    const hasKanji = surfaceChars.some(ch => {
      const cp = ch.codePointAt(0);
      return cp >= 0x4E00 && cp <= 0x9FFF;
    });

    if (!hasKanji) {
      surfaceChars.forEach((ch, i) => {
        const pos = start + i;
        if (pos < readingMap.length) {
          readingMap[pos] = [PHONEME_MAP[ch] ? ch : kataToHira(ch)];
        }
      });
      continue;
    }

    // 漢字を含む場合: 読み全体をまとめて均等分配
    const perChar = Math.max(1, Math.ceil(readingChars.length / surfaceChars.length));
    surfaceChars.forEach((ch, i) => {
      const pos = start + i;
      if (pos >= readingMap.length) return;
      const slice = readingChars.slice(i * perChar, (i + 1) * perChar);
      readingMap[pos] = slice.length > 0 ? slice : readingChars.slice(-1);
    });
  }

  return readingMap.map((reading, i) => reading || [chars[i]]);
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

function phonemeToColor(info) {
  if (!info) return [80, 80, 80, 180];

  // 特殊モーラ
  if (info.special === "geminate") return [15, 15, 20, 255];
  if (info.special === "moraic_nasal") return [...hslToRgb(30/360, 0.50, 0.42), 255];
  if (info.special === "long") return [180, 185, 200, 100];

  // 母音の基調色
  const vowelColor = info.vowel ? VOWEL_COLORS[info.vowel] : VOWEL_COLORS["a"];
  let [h, s, l] = vowelColor;

  // 調音位置で色相をシフト
  const hueShift = PLACE_HUE_SHIFT[info.place] || 0;
  h = ((h + hueShift) % 360 + 360) % 360;

  // 調音方法で彩度・明度を修飾
  const mod = MANNER_MOD[info.manner] || MANNER_MOD["vowel"];
  s = Math.min(1, Math.max(0.15, s * mod[0]));
  l = Math.min(0.85, Math.max(0.15, l + mod[1]));

  // 有声/無声
  if (info.voiced && info.manner !== "vowel" && info.manner !== "glide" && info.manner !== "nasal") {
    l = Math.max(0.15, l - 0.08);
    s = Math.min(1, s * 0.85);
  }
  const alpha = info.voiced ? 255 : 210;

  return [...hslToRgb(h / 360, s, l), alpha];
}

// 読みの文字列（ひらがな配列）から色を決定
function readingToColor(readingChars) {
  if (!readingChars || readingChars.length === 0) return [80, 80, 80, 180];

  let totalR = 0, totalG = 0, totalB = 0, totalA = 0;
  let count = 0;

  for (const ch of readingChars) {
    const info = PHONEME_MAP[ch];
    if (info) {
      const [r, g, b, a] = phonemeToColor(info);
      totalR += r; totalG += g; totalB += b; totalA += a;
      count++;
    }
  }

  if (count === 0) return [80, 80, 80, 180];
  return [
    Math.round(totalR / count),
    Math.round(totalG / count),
    Math.round(totalB / count),
    Math.round(totalA / count),
  ];
}

/* ─── 凡例データ ─── */

function sampleColor(vowel, place, manner, voiced) {
  return phonemeToColor({ place, manner, voiced, vowel });
}

const LEGEND_ITEMS = [
  { label: "母音 = 基調色", items: [
    { color: hslToRgb(VOWEL_COLORS.a[0]/360, VOWEL_COLORS.a[1], VOWEL_COLORS.a[2]), text: "あ段 → 赤" },
    { color: hslToRgb(VOWEL_COLORS.i[0]/360, VOWEL_COLORS.i[1], VOWEL_COLORS.i[2]), text: "い段 → 明るい黄" },
    { color: hslToRgb(VOWEL_COLORS.u[0]/360, VOWEL_COLORS.u[1], VOWEL_COLORS.u[2]), text: "う段 → 暗い青" },
    { color: hslToRgb(VOWEL_COLORS.e[0]/360, VOWEL_COLORS.e[1], VOWEL_COLORS.e[2]), text: "え段 → 黄緑" },
    { color: hslToRgb(VOWEL_COLORS.o[0]/360, VOWEL_COLORS.o[1], VOWEL_COLORS.o[2]), text: "お段 → 暗い紺" },
  ]},
  { label: "子音行 = 色相シフト (あ段の例)", items: [
    { color: sampleColor("a", "velar", "stop", false).slice(0,3), text: "か行 (軟口蓋)" },
    { color: sampleColor("a", "alveolar", "fricative", false).slice(0,3), text: "さ行 (歯茎)" },
    { color: sampleColor("a", "alveolar", "stop", false).slice(0,3), text: "た行 (歯茎)" },
    { color: sampleColor("a", "alveolar", "nasal", true).slice(0,3), text: "な行 (鼻音)" },
    { color: sampleColor("a", "glottal", "fricative", false).slice(0,3), text: "は行 (声門)" },
    { color: sampleColor("a", "bilabial", "nasal", true).slice(0,3), text: "ま行 (唇)" },
  ]},
  { label: "濁音 = 暗く重い", items: [
    { color: sampleColor("a", "velar", "stop", false).slice(0,3), text: "清音 (か)" },
    { color: sampleColor("a", "velar", "stop", true).slice(0,3), text: "濁音 (が)" },
  ]},
  { label: "特殊モーラ", items: [
    { color: [15, 15, 20], text: "っ → 沈黙の黒" },
    { color: hslToRgb(30/360, 0.50, 0.42), text: "ん → 暗い暖色" },
    { color: [180, 185, 200], text: "ー → 淡い半透明", alpha: 100 },
  ]},
];

/* ─── App ─── */

export default function App() {
  const [text, setText] = useState("ことばの音には色がある。静かな鼻音は深く響き、鋭い破裂音は閃光のように走る。");
  const [pixelSize, setPixelSize] = useState(8);
  const [info, setInfo] = useState("");
  const [hoveredChar, setHoveredChar] = useState(null);
  const [tokenizerStatus, setTokenizerStatus] = useState("loading");
  const canvasRef = useRef(null);
  const charsRef = useRef([]);
  const readingsRef = useRef([]);
  const colsRef = useRef(0);
  const tokenizerRef = useRef(null);

  // kuromoji初期化
  useEffect(() => {
    import("kuromoji").then((mod) => {
      const kuromojiLib = mod.default || mod;
      kuromojiLib.builder({ dicPath: "/dict/" }).build((err, tokenizer) => {
        if (err) {
          console.error("kuromoji init error:", err);
          setTokenizerStatus("failed");
          return;
        }
        tokenizerRef.current = tokenizer;
        setTokenizerStatus("ready");
      });
    }).catch((e) => {
      console.error("kuromoji load error:", e);
      setTokenizerStatus("failed");
    });
  }, []);

  const render = useCallback(() => {
    const rawChars = [...text].filter(c => c !== "\n");
    charsRef.current = rawChars;
    if (!rawChars.length || !canvasRef.current) return;

    const joinedText = rawChars.join("");
    let readings;
    if (tokenizerRef.current) {
      try {
        const tokens = tokenizerRef.current.tokenize(joinedText);
        readings = textToReadings(tokens, joinedText);
      } catch (e) {
        console.error("tokenize error:", e);
        readings = rawChars.map(ch => [ch]);
      }
    } else {
      readings = rawChars.map(ch => [ch]);
    }
    readingsRef.current = readings;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const cols = Math.ceil(Math.sqrt(rawChars.length * 1.6));
    colsRef.current = cols;
    const rows = Math.ceil(rawChars.length / cols);
    canvas.width = cols * pixelSize;
    canvas.height = rows * pixelSize;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    rawChars.forEach((ch, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const [r, g, b, a] = readingToColor(readings[i]);
      ctx.fillStyle = `rgba(${r},${g},${b},${a/255})`;
      ctx.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
    });
    setInfo(`${rawChars.length} 文字 → ${cols}×${rows} px`);
  }, [text, pixelSize, tokenizerStatus]);

  useEffect(() => { render(); }, [render]);

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
      const reading = readingsRef.current[idx];
      const readingStr = reading ? reading.join("") : "";
      const firstPhoneme = reading && reading.length > 0 ? PHONEME_MAP[reading[0]] : null;
      if (firstPhoneme) {
        const placeLabel = firstPhoneme.place || "—";
        const mannerLabel = firstPhoneme.manner || "—";
        const voiceLabel = firstPhoneme.voiced ? "有声" : "無声";
        const vowelLabel = firstPhoneme.vowel || "—";
        const kanjiLabel = ch !== readingStr ? ` (${readingStr})` : "";
        setHoveredChar(`「${ch}」${kanjiLabel} ${placeLabel} / ${mannerLabel} / ${voiceLabel} / 母音:${vowelLabel}`);
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
        {tokenizerStatus === "loading" && (
          <div className="loading">辞書を読み込み中...</div>
        )}
        {tokenizerStatus === "failed" && (
          <div className="loading">辞書の読み込みに失敗。ひらがな・カタカナのみ対応。</div>
        )}
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
          <p>共感覚・音象徴研究に基づき、母音が色の基調を決め、子音の調音位置・方法が修飾します。漢字は形態素解析で読みを取得。</p>
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
