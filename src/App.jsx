import { useState, useRef, useEffect } from "react";
import "./App.css";

const MODES = {
  unicode: {
    label: "Unicode → 色相",
    desc: "各文字のコードポイントを色相にマップ。ASCII/ひらがな/漢字が自然に異なる色帯に分布する。"
  },
  type: {
    label: "文字種 → 色族",
    desc: "文字の種類で色族を決定。英数字→橙、ひらがな→青、カタカナ→緑、漢字→紫、記号→灰。"
  },
  density: {
    label: "複雑度 → 明度",
    desc: "文字の複雑度（漢字は画数の代理指標）を明度にマップ。複雑な文字ほど暗い。"
  }
};

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
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }
  return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

function charToColor(ch, mode) {
  const cp = ch.codePointAt(0);
  if (mode === "unicode") {
    let hue;
    if (cp < 128) hue = (cp / 128) * 60;
    else if (cp >= 0x3040 && cp <= 0x30FF) hue = 180 + ((cp - 0x3040) / (0x30FF - 0x3040)) * 60;
    else if (cp >= 0x4E00 && cp <= 0x9FFF) hue = 260 + ((cp - 0x4E00) / (0x9FFF - 0x4E00)) * 80;
    else hue = cp % 360;
    return [...hslToRgb(hue / 360, 0.7, 0.5), 255];
  }
  if (mode === "type") {
    if (cp < 33) return [200, 200, 200, 40];
    if ((cp >= 65 && cp <= 90) || (cp >= 97 && cp <= 122)) return [...hslToRgb(30/360, 0.8, 0.5), 255];
    if (cp >= 48 && cp <= 57) return [...hslToRgb(50/360, 0.9, 0.5), 255];
    if (cp < 128) return [...hslToRgb(0, 0, 0.55), 255];
    if (cp >= 0x3040 && cp <= 0x309F) return [...hslToRgb(210/360, 0.75, 0.55), 255];
    if (cp >= 0x30A0 && cp <= 0x30FF) return [...hslToRgb(155/360, 0.7, 0.48), 255];
    if (cp >= 0x4E00 && cp <= 0x9FFF) return [...hslToRgb(280/360, 0.65, 0.48), 255];
    return [...hslToRgb((cp % 360) / 360, 0.6, 0.5), 255];
  }
  if (mode === "density") {
    let baseHue, complexity;
    if (cp < 128) { baseHue = 30; complexity = (cp % 95) / 95; }
    else if (cp >= 0x3040 && cp <= 0x309F) { baseHue = 210; complexity = (cp - 0x3040) / (0x309F - 0x3040); }
    else if (cp >= 0x30A0 && cp <= 0x30FF) { baseHue = 155; complexity = (cp - 0x30A0) / (0x30FF - 0x30A0); }
    else if (cp >= 0x4E00 && cp <= 0x9FFF) { baseHue = 280; complexity = Math.min(1, (cp - 0x4E00) / 8000); }
    else { baseHue = cp % 360; complexity = 0.5; }
    return [...hslToRgb(baseHue / 360, 0.7, 0.75 - complexity * 0.45), 255];
  }
}

export default function App() {
  const [text, setText] = useState("自由意志は存在するか。現実とは共有された妄想だ。科学はその説明のプロトコルに過ぎない。");
  const [mode, setMode] = useState("unicode");
  const [pixelSize, setPixelSize] = useState(8);
  const [info, setInfo] = useState("");
  const canvasRef = useRef(null);

  const render = () => {
    const chars = [...text].filter(c => c !== "\n");
    if (!chars.length || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const cols = Math.ceil(Math.sqrt(chars.length * 1.6));
    const rows = Math.ceil(chars.length / cols);
    canvas.width = cols * pixelSize;
    canvas.height = rows * pixelSize;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    chars.forEach((ch, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const [r, g, b, a] = charToColor(ch, mode);
      ctx.fillStyle = `rgba(${r},${g},${b},${a/255})`;
      ctx.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
    });
    setInfo(`${chars.length} 文字 → ${cols}×${rows} px`);
  };

  useEffect(() => { render(); }, [text, mode, pixelSize]);

  const save = () => {
    const link = document.createElement("a");
    link.download = "text_pixels.png";
    link.href = canvasRef.current.toDataURL();
    link.click();
  };

  return (
    <div className="app">
      <header>
        <h1>text → pixel</h1>
        <p>文字を色に変換する</p>
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
            <label>マッピング</label>
            <div className="btn-group">
              {Object.entries(MODES).map(([key, val]) => (
                <button
                  key={key}
                  className={mode === key ? "active" : ""}
                  onClick={() => setMode(key)}
                >{val.label}</button>
              ))}
            </div>
          </div>
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
          <canvas ref={canvasRef} />
        </div>
        <div className="footer-row">
          <span className="info">{info}</span>
          <button className="save-btn" onClick={save}>PNG保存</button>
        </div>
        <div className="desc">{MODES[mode].desc}</div>
      </main>
    </div>
  );
}
