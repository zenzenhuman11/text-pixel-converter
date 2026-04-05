import { useState, useRef, useEffect, useCallback } from "react";
import kuromoji from "kuromoji";
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
  if (info.special === "geminate") return [20, 20, 20, 255];
  if (info.special === "moraic_nasal") return [...hslToRgb(45/360, 0.4, 0.45), 255];
  if (info.special === "long") return [200, 200, 220, 120];

  let hue;
  if (info.place === "vowel" && info.vowel) {
    const [front] = VOWELS[info.vowel];
    hue = front * 270 + 20;
  } else if (info.place && PLACE[info.place] != null) {
    hue = PLACE[info.place];
    if (info.vowel && VOWELS[info.vowel]) {
      const [front] = VOWELS[info.vowel];
      hue += (front - 0.5) * 30;
    }
  } else {
    hue = 0;
  }

  const sonority = MANNER[info.manner] || 0.5;
  const saturation = 0.3 + sonority * 0.6;

  let lightness = 0.45;
  if (info.vowel && VOWELS[info.vowel]) {
    const [, openness] = VOWELS[info.vowel];
    lightness = 0.3 + openness * 0.35;
  }

  const alpha = info.voiced ? 255 : 200;

  return [...hslToRgb(((hue % 360) + 360) % 360 / 360, saturation, lightness), alpha];
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
          <p>各文字の発音を音声学的に分析し、4つの次元で色にマッピングします。漢字は形態素解析で読みを取得し、その音韻から色を決定します。</p>
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
