import { useState, useRef, useEffect, useCallback } from "react";
import kuromoji from "kuromoji";
import "./App.css";

/* ─── 研究ベースの音色マッピング ─── */

// 母音 → 基調色 [H, S, L]
// 研究知見: a=赤, i=明るい黄/白, u=暗い青, e=黄緑, o=暗い紺/黒
const VOWEL_COLORS = {
  a: [0,    0.85, 0.55],  // 赤 — 最も一貫した知見
  i: [50,   0.75, 0.72],  // 明るい黄 — 前舌・閉=明るく黄寄り
  u: [225,  0.65, 0.30],  // 暗い青 — 後舌・閉=暗く青
  e: [100,  0.60, 0.52],  // 黄緑 — 前舌・中=緑〜黄
  o: [235,  0.45, 0.22],  // 暗い紺 — 後舌・中=暗い
};

// 子音の性質 → 色の修飾
// 阻害音(破裂・摩擦)=冷たく鋭い、共鳴音(鼻・流・半母音)=暖かく柔らかい
const CONSONANT_MOD = {
  // [色相シフト, 彩度倍率, 明度シフト]
  stop:        [0,    0.85, -0.05],  // 破裂音: やや暗く、彩度控えめ
  affricate:   [5,    0.80, -0.03],  // 破擦音: 破裂に近い
  fricative:   [10,   0.75, +0.05],  // 摩擦音: やや明るく、くすんだ
  nasal:       [-10,  1.10, +0.08],  // 鼻音: 暖かく柔らかい、やや明るく鮮やか
  liquid:      [-5,   1.05, +0.05],  // 流音: わずかに暖色寄り
  glide:       [0,    1.00, +0.03],  // 半母音: ほぼ母音のまま
  vowel:       [0,    1.00, 0],      // 純母音: そのまま
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

// テキストを形態素解析し、各元文字に対応する読み（ひらがな）配列を返す
// 例: "漢字" → ["か","ん","じ"] (元文字 "漢","字" に対して読みの文字を展開)
function textToReadings(tokens, originalChars) {
  // トークンから読みマップを構築: 元テキストの各文字位置 → 読みのひらがな文字列
  const readingMap = new Array(originalChars.length).fill(null);

  for (const token of tokens) {
    const surface = token.surface_form;
    const reading = token.reading; // カタカナ
    const start = token.word_position - 1; // 0-indexed

    if (reading && reading !== "*") {
      // 読みをひらがなに変換
      const hiraReading = kataToHira(reading);
      const surfaceChars = [...surface];
      const readingChars = [...hiraReading];

      if (surfaceChars.length === 1) {
        // 1文字のトークン: 読み全体を割り当て
        if (start < readingMap.length) {
          readingMap[start] = readingChars;
        }
      } else {
        // 複数文字のトークン: 各文字に読みを分配
        // ひらがな/カタカナはそのまま、漢字部分に残りの読みを割り当て
        let readingIdx = 0;
        for (let i = 0; i < surfaceChars.length; i++) {
          const pos = start + i;
          if (pos >= readingMap.length) break;
          const ch = surfaceChars[i];
          const isKanji = ch.codePointAt(0) >= 0x4E00 && ch.codePointAt(0) <= 0x9FFF;

          if (!isKanji) {
            // ひらがな/カタカナ: そのまま（読み側も1文字進める）
            readingMap[pos] = [PHONEME_MAP[ch] ? ch : kataToHira(ch)];
            readingIdx++;
          } else {
            // 漢字: 残りの読みから、次の非漢字文字までの分を割り当て
            // 次のひらがな/カタカナ文字を探して、そこまでの読みを漢字に割り当て
            let kanjiEnd = i + 1;
            while (kanjiEnd < surfaceChars.length) {
              const nextCp = surfaceChars[kanjiEnd].codePointAt(0);
              if (nextCp < 0x4E00 || nextCp > 0x9FFF) break;
              kanjiEnd++;
            }
            const kanjiCount = kanjiEnd - i;

            // 残りのひらがな/カタカナ文字がsurfaceの末尾にいくつあるか
            let suffixMatchCount = 0;
            let ri = readingChars.length - 1;
            let si = surfaceChars.length - 1;
            while (si > kanjiEnd - 1 && ri >= readingIdx) {
              const sCh = surfaceChars[si];
              const sHira = kataToHira(sCh);
              if (sHira === readingChars[ri]) {
                suffixMatchCount++;
                ri--;
                si--;
              } else {
                break;
              }
            }

            const readingsForKanji = readingChars.slice(readingIdx, readingChars.length - suffixMatchCount - (surfaceChars.length - kanjiEnd - suffixMatchCount));
            const perKanji = Math.ceil(readingsForKanji.length / kanjiCount);

            for (let k = 0; k < kanjiCount; k++) {
              const kPos = start + i + k;
              if (kPos >= readingMap.length) break;
              const slice = readingsForKanji.slice(k * perKanji, (k + 1) * perKanji);
              readingMap[kPos] = slice.length > 0 ? slice : ["あ"];
            }
            readingIdx += readingsForKanji.length;
            i = kanjiEnd - 1; // forのi++で kanjiEnd になる
          }
        }
      }
    } else {
      // 読みがないトークン: そのまま
      const surfaceChars = [...surface];
      for (let i = 0; i < surfaceChars.length; i++) {
        const pos = start + i;
        if (pos < readingMap.length) {
          readingMap[pos] = [surfaceChars[i]];
        }
      }
    }
  }

  // null埋めされた部分はそのまま元文字を使う
  return readingMap.map((reading, i) => reading || [originalChars[i]]);
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
  if (info.special === "geminate") return [15, 15, 20, 255];     // 促音 → ほぼ黒（沈黙の圧縮）
  if (info.special === "moraic_nasal") return [...hslToRgb(30/360, 0.45, 0.40), 255]; // ん → 暗い暖色
  if (info.special === "long") return [180, 185, 200, 100];      // 長音 → 淡く透ける

  // 母音の基調色を取得
  const vowelColor = info.vowel ? VOWEL_COLORS[info.vowel] : VOWEL_COLORS["a"];
  let [h, s, l] = vowelColor;

  // 子音で修飾
  const mod = CONSONANT_MOD[info.manner] || CONSONANT_MOD["vowel"];
  h = ((h + mod[0]) % 360 + 360) % 360;
  s = Math.min(1, Math.max(0, s * mod[1]));
  l = Math.min(0.85, Math.max(0.12, l + mod[2]));

  // 有声/無声: 濁音はより暗く重い色に
  const alpha = info.voiced ? 255 : 210;
  if (info.voiced && info.manner !== "vowel" && info.manner !== "glide" && info.manner !== "nasal") {
    l = Math.max(0.12, l - 0.08);
    s = Math.min(1, s * 0.90);
  }

  return [...hslToRgb(h / 360, s, l), alpha];
}

// 読みの文字列（ひらがな配列）から色を決定
// 複数文字の読みは平均色を返す
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

const LEGEND_ITEMS = [
  { label: "母音 = 基調色", items: [
    { color: hslToRgb(VOWEL_COLORS.a[0]/360, VOWEL_COLORS.a[1], VOWEL_COLORS.a[2]), text: "あ段 → 赤" },
    { color: hslToRgb(VOWEL_COLORS.i[0]/360, VOWEL_COLORS.i[1], VOWEL_COLORS.i[2]), text: "い段 → 明るい黄" },
    { color: hslToRgb(VOWEL_COLORS.u[0]/360, VOWEL_COLORS.u[1], VOWEL_COLORS.u[2]), text: "う段 → 暗い青" },
    { color: hslToRgb(VOWEL_COLORS.e[0]/360, VOWEL_COLORS.e[1], VOWEL_COLORS.e[2]), text: "え段 → 黄緑" },
    { color: hslToRgb(VOWEL_COLORS.o[0]/360, VOWEL_COLORS.o[1], VOWEL_COLORS.o[2]), text: "お段 → 暗い紺" },
  ]},
  { label: "子音 = 色の修飾", items: [
    { color: hslToRgb(VOWEL_COLORS.a[0]/360, VOWEL_COLORS.a[1]*0.85, VOWEL_COLORS.a[2]-0.05), text: "阻害音 (か・た・さ): 硬く冷たく" },
    { color: hslToRgb((VOWEL_COLORS.a[0]-10)/360, VOWEL_COLORS.a[1]*1.10, VOWEL_COLORS.a[2]+0.08), text: "共鳴音 (な・ま・ら): 柔らかく暖かく" },
  ]},
  { label: "濁音 = 暗く重い", items: [
    { color: hslToRgb(VOWEL_COLORS.a[0]/360, VOWEL_COLORS.a[1]*0.85, VOWEL_COLORS.a[2]-0.05), text: "清音 (か・さ・た)" },
    { color: hslToRgb(VOWEL_COLORS.a[0]/360, VOWEL_COLORS.a[1]*0.85*0.90, VOWEL_COLORS.a[2]-0.05-0.08), text: "濁音 (が・ざ・だ)" },
  ]},
  { label: "特殊モーラ", items: [
    { color: [15, 15, 20], text: "っ → 沈黙の黒" },
    { color: hslToRgb(30/360, 0.45, 0.40), text: "ん → 暗い暖色" },
    { color: [180, 185, 200], text: "ー → 淡い半透明", alpha: 100 },
  ]},
];

/* ─── App ─── */

export default function App() {
  const [text, setText] = useState("ことばの音には色がある。静かな鼻音は深く響き、鋭い破裂音は閃光のように走る。");
  const [pixelSize, setPixelSize] = useState(8);
  const [info, setInfo] = useState("");
  const [hoveredChar, setHoveredChar] = useState(null);
  const [tokenizerReady, setTokenizerReady] = useState(false);
  const canvasRef = useRef(null);
  const charsRef = useRef([]);
  const readingsRef = useRef([]);
  const colsRef = useRef(0);
  const tokenizerRef = useRef(null);

  // kuromoji初期化
  useEffect(() => {
    kuromoji.builder({ dicPath: "/dict/" }).build((err, tokenizer) => {
      if (err) {
        console.error("kuromoji init error:", err);
        return;
      }
      tokenizerRef.current = tokenizer;
      setTokenizerReady(true);
    });
  }, []);

  const render = useCallback(() => {
    const chars = [...text].filter(c => c !== "\n");
    charsRef.current = chars;
    if (!chars.length || !canvasRef.current) return;

    // 形態素解析で読みを取得
    let readings;
    if (tokenizerRef.current) {
      const tokens = tokenizerRef.current.tokenize(chars.join(""));
      readings = textToReadings(tokens, chars);
    } else {
      // tokenizer未ロード時: ひらがな/カタカナはそのまま、漢字はグレー
      readings = chars.map(ch => [ch]);
    }
    readingsRef.current = readings;

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
      const [r, g, b, a] = readingToColor(readings[i]);
      ctx.fillStyle = `rgba(${r},${g},${b},${a/255})`;
      ctx.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
    });
    setInfo(`${chars.length} 文字 → ${cols}×${rows} px`);
  }, [text, pixelSize, tokenizerReady]);

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

      // 読みの最初の文字で音韻情報を表示
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
        {!tokenizerReady && (
          <div className="loading">辞書を読み込み中...</div>
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
          <p>共感覚・音象徴研究に基づき、母音が色の基調を決め、子音の性質が修飾します。漢字は形態素解析で読みを取得。</p>
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
