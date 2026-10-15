import { FFmpeg } from "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/esm/index.js";
import { toBlobURL } from "https://cdn.jsdelivr.net/npm/@ffmpeg/util@0.12.1/dist/esm/index.js";

const $ = (id) => document.getElementById(id);
const SAMPLE = {
  "title": "【要チェック】暮らしが劇的に変わる便利グッズ3選",
  "duration_seconds": 40,
  "verification_required": true,
  "narration": "生活をちょっと楽にする、買ってよかった便利グッズ3選！第3位、コードレスハンディクリーナー。気になった時にサッと使えて、デスク周りや車の掃除に最適です。第2位、自動ハンドソープディスペンサー。手をかざすだけで泡が出て、衛生的な上に手洗いがとてもスムーズになります。第1位、電子ペーパーメモパッド。ワンタッチで消去でき、紙を使わずアイデアや伝言をパッと残せます。気になった方はぜひチェックしてみてください！",
  "scenes": [
    {"id":"intro","start":0,"end":3,"narration":"生活をちょっと楽にする、買ってよかった便利グッズ3選！","caption":"暮らしが変わる！\\n便利グッズ3選","visual_prompt":"縦型9:16、部屋がすっきり片付いた清潔感のあるおしゃれなリビングのイメージ画像","asset_type":"illustration","verification_required":false},
    {"id":"rank3","start":3,"end":13,"narration":"第3位、コードレスハンディクリーナー。気になった時にサッと使えて、デスク周りや車の掃除に最適です。","caption":"第3位：ハンディクリーナー\\n気になったらサッと清掃\\nデスクや車の掃除に最適（商品名要確認）","visual_prompt":"縦型9:16、コンパクトな充電式小型掃除機でデスクの上を掃除しているイメージ画像","asset_type":"illustration","verification_required":true},
    {"id":"rank2","start":13,"end":23,"narration":"第2位、自動ハンドソープディスペンサー。手をかざすだけで泡が出て、衛生的な上に手洗いがとてもスムーズになります。","caption":"第2位：自動ディスペンサー\\n手をかざすだけで泡が出る\\n衛生的で手洗いがスムーズ（商品名要確認）","visual_prompt":"縦型9:16、洗面台でセンサー式ディスペンサーに手をかざしてふわふわの泡を受けるイメージ画像","asset_type":"illustration","verification_required":true},
    {"id":"rank1","start":23,"end":35,"narration":"第1位、電子ペーパーメモパッド。ワンタッチで消去でき、紙を使わずアイデアや伝言をパッと残せます。","caption":"第1位：電子ペーパーメモ\\nボタン一つで一括消去\\n紙を使わず手軽にメモ（商品名要確認）","visual_prompt":"縦型9:16、スタイラスペンでデジタルメモパッドに文字を書いているイメージ画像","asset_type":"illustration","verification_required":true},
    {"id":"outro","start":35,"end":40,"narration":"気になった方はぜひチェックしてみてください！","caption":"気になるアイテムは\\nありましたか？\\n詳細をチェック！","visual_prompt":"縦型9:16、3つの便利グッズが整然と並んでいるシンプルなイメージ画像","asset_type":"illustration","verification_required":false}
  ],
  "youtube": {
    "title":"【便利グッズ】生活が変わる！買ってよかった日常アイテム3選 #Shorts",
    "description":"日常の「ちょっと困った」を解決してくれる便利グッズをランキング形式で3つ紹介します。具体的に気になる商品がある方は、各メーカーの公式サイト等で商品名や性能をご確認ください。",
    "hashtags":["Shorts","便利グッズ","ランキング","買ってよかった","便利アイテム"]
  }
};

let project = null;
let imageFiles = new Map();
let imageURLs = new Map();
let ffmpeg = null;
let ffmpegReady = false;
let outputURL = null;

$("jsonInput").value = JSON.stringify(SAMPLE, null, 2);

function setStatus(msg) { $("status").textContent = msg; }
function validateProject(data) {
  if (!data || !Array.isArray(data.scenes) || data.scenes.length < 1) throw new Error("scenes配列がありません。");
  const duration = Number(data.duration_seconds || 40);
  if (!(duration > 0 && duration <= 180)) throw new Error("duration_secondsは1〜180秒にしてください。");
  let last = 0;
  data.scenes.forEach((s, i) => {
    if (!Number.isFinite(Number(s.start)) || !Number.isFinite(Number(s.end)) || Number(s.start) < 0 || Number(s.end) <= Number(s.start)) {
      throw new Error(`場面${i+1}のstart/endが不正です。`);
    }
    if (Math.abs(Number(s.start) - last) > 0.05) throw new Error(`場面${i+1}の開始時刻が前の場面と連続していません（開始=${s.start}、期待=${last}）。`);
    if (!s.caption) s.caption = "";
    last = Number(s.end);
  });
  if (Math.abs(last - duration) > 0.1) throw new Error(`最後の場面はduration_seconds（${duration}秒）まで続けてください。`);
  return data;
}

function parseJSON() {
  const data = validateProject(JSON.parse($("jsonInput").value));
  project = data;
  renderSceneInputs();
  setStatus(`JSON読み込み完了：${data.scenes.length}場面 / ${data.duration_seconds}秒。各場面の画像とナレーション音声を選んでください。`);
}

function renderSceneInputs() {
  const root = $("sceneInputs");
  root.innerHTML = "";
  imageFiles.clear();
  imageURLs.forEach(url => URL.revokeObjectURL(url));
  imageURLs.clear();
  project.scenes.forEach((scene, idx) => {
    const section = document.createElement("div");
    section.className = "scene";
    const preview = document.createElement("canvas");
    preview.className = "preview";
    preview.width = 270; preview.height = 480;
    preview.setAttribute("aria-label", `${scene.id}プレビュー`);
    const content = document.createElement("div");
    content.className = "scenecontent";
    const head = document.createElement("div");
    head.className = "scenehead";
    const name = document.createElement("strong");
    name.textContent = `${idx+1}. ${scene.id}`;
    const time = document.createElement("span");
    time.textContent = `${scene.start}–${scene.end}秒`;
    head.append(name, time);
    const caption = document.createElement("div");
    caption.style.whiteSpace = "pre-wrap";
    caption.style.margin = "8px 0";
    caption.textContent = scene.caption || "(字幕なし)";
    const prompt = document.createElement("small");
    prompt.textContent = scene.visual_prompt || "画像を選択してください";
    const label = document.createElement("label");
    label.className = "label";
    label.textContent = "この場面の画像";
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.addEventListener("change", () => {
      const file = input.files?.[0];
      if (!file) return;
      imageFiles.set(scene.id, file);
      const old = imageURLs.get(scene.id);
      if (old) URL.revokeObjectURL(old);
      const url = URL.createObjectURL(file);
      imageURLs.set(scene.id, url);
      drawPreview(preview, scene, url).catch(err => setStatus(`画像プレビュー失敗：${err.message}`));
    });
    content.append(head, caption, prompt, label, input);
    section.append(preview, content);
    root.append(section);
    drawPreview(preview, scene, null).catch(() => {});
  });
}

function wrapLines(ctx, text, maxWidth) {
  const out = [];
  for (const paragraph of String(text || "").split("\n")) {
    let line = "";
    for (const ch of paragraph) {
      const next = line + ch;
      if (line && ctx.measureText(next).width > maxWidth) {
        out.push(line); line = ch;
      } else line = next;
    }
    out.push(line);
  }
  return out;
}

async function drawPreview(canvas, scene, url) {
  const ctx = canvas.getContext("2d");
  await drawScene(ctx, canvas.width, canvas.height, scene, url);
}

async function drawScene(ctx, width, height, scene, imageURL) {
  ctx.clearRect(0,0,width,height);
  if (imageURL) {
    const img = new Image();
    img.src = imageURL;
    await img.decode();
    const scale = Math.max(width/img.width, height/img.height);
    const sw = width/scale, sh = height/scale;
    ctx.drawImage(img, (img.width-sw)/2, (img.height-sh)/2, sw, sh, 0, 0, width, height);
  } else {
    const g = ctx.createLinearGradient(0,0,width,height);
    g.addColorStop(0,"#17314b"); g.addColorStop(1,"#111827");
    ctx.fillStyle = g; ctx.fillRect(0,0,width,height);
    ctx.fillStyle = "rgba(139,233,253,.12)";
    ctx.beginPath(); ctx.arc(width*.78,height*.23,width*.28,0,Math.PI*2); ctx.fill();
    ctx.fillStyle = "#8be9fd"; ctx.font = `bold ${Math.round(width*.09)}px -apple-system, sans-serif`;
    ctx.fillText("3選 RANKING", width*.08, height*.16);
  }
  // Contrast overlay, keeps captions readable over light photos.
  const overlay = ctx.createLinearGradient(0,height*.52,0,height);
  overlay.addColorStop(0,"rgba(0,0,0,0)");
  overlay.addColorStop(.22,"rgba(0,0,0,.56)");
  overlay.addColorStop(1,"rgba(0,0,0,.88)");
  ctx.fillStyle = overlay; ctx.fillRect(0,0,width,height);
  const caption = String(scene.caption || "");
  const fontSize = Math.round(width * (caption.length > 42 ? .046 : .055));
  ctx.font = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, "Hiragino Sans", "Yu Gothic", sans-serif`;
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.lineJoin = "round"; ctx.strokeStyle = "rgba(0,0,0,.9)"; ctx.lineWidth = Math.max(3,width*.012);
  const lines = wrapLines(ctx, caption, width*.84);
  const lineHeight = fontSize*1.32;
  const blockH = lines.length*lineHeight;
  let y = height*.79 - blockH/2;
  for (const line of lines) {
    ctx.strokeText(line, width/2, y);
    ctx.fillStyle = "#ffffff"; ctx.fillText(line, width/2, y);
    y += lineHeight;
  }
  // Small rank marker.
  ctx.textAlign = "left"; ctx.textBaseline = "top";
  ctx.font = `700 ${Math.round(width*.04)}px -apple-system, sans-serif`;
  ctx.fillStyle = "rgba(255,255,255,.88)";
  ctx.fillText(`${Number(scene.start).toFixed(0)}s`, width*.06, height*.04);
}

async function canvasToBlob(canvas) {
  return new Promise((resolve, reject) => canvas.toBlob(b => b ? resolve(b) : reject(new Error("画像の生成に失敗しました。")), "image/png"));
}

async function ensureFFmpeg() {
  if (ffmpegReady) return;
  setStatus("FFmpegエンジンを読み込み中…初回は時間がかかります。");
  ffmpeg = new FFmpeg();
  ffmpeg.on("log", ({message}) => {
    if (message && /error|failed/i.test(message)) setStatus(message);
  });
  ffmpeg.on("progress", ({progress}) => {
    if (Number.isFinite(progress)) $("progress").value = Math.max(0,Math.min(100,Math.round(progress*100)));
  });
  const base = "https://cdn.jsdelivr.net/npm/@ffmpeg/core@0.12.10/dist/umd";
  const coreURL = await toBlobURL(`${base}/ffmpeg-core.js`, "text/javascript");
  const wasmURL = await toBlobURL(`${base}/ffmpeg-core.wasm`, "application/wasm");
  const classWorkerURL = await toBlobURL(
  "https://cdn.jsdelivr.net/npm/@ffmpeg/ffmpeg@0.12.10/dist/umd/worker.js",
  "text/javascript"
);
await ffmpeg.load({ coreURL, wasmURL, classWorkerURL });
  ffmpegReady = true;
}

function safeExt(file, fallback) {
  const m = (file?.name || "").toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  const ext = m ? m[1] : fallback;
  return ["mp3","wav","m4a","aac","ogg","mp4","mov","webm","png","jpg","jpeg","webp"].includes(ext) ? ext : fallback;
}

async function renderVideo() {
  try {
    if (!project) parseJSON();
    const audio = $("audioInput").files?.[0];
    if (!audio) throw new Error("ナレーション音声または音声付き動画を選択してください。");
    $("renderBtn").disabled = true;
    $("progress").value = 0;
    $("outputArea").hidden = true;
    await ensureFFmpeg();

    const duration = Number(project.duration_seconds || 40);
    const args = [];
    const filterParts = [];
    let idx = 0;
    const imageNames = [];

    for (let i=0; i<project.scenes.length; i++) {
      const scene = project.scenes[i];
      const canvas = document.createElement("canvas");
      canvas.width = 720; canvas.height = 1280; // reduces memory load on iPhone
      const file = imageFiles.get(scene.id);
      const url = file ? URL.createObjectURL(file) : null;
      await drawScene(canvas.getContext("2d"), canvas.width, canvas.height, scene, url);
      if (url) URL.revokeObjectURL(url);
      const blob = await canvasToBlob(canvas);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const name = `scene_${i}.png`;
      await ffmpeg.writeFile(name, bytes);
      imageNames.push(name);
      const sec = (Number(scene.end) - Number(scene.start)).toFixed(3);
      args.push("-loop","1","-framerate","30","-t",sec,"-i",name);
      filterParts.push(`[${idx}:v]scale=720:1280,fps=30,format=yuv420p[v${idx}]`);
      idx++;
      $("progress").value = Math.round((i+1)/project.scenes.length*12);
      setStatus(`場面画像を準備中… ${i+1}/${project.scenes.length}`);
    }

    const audioExt = safeExt(audio, "mp4");
    const audioName = `narration.${audioExt}`;
    await ffmpeg.writeFile(audioName, new Uint8Array(await audio.arrayBuffer()));
    args.push("-i", audioName);
    const audioInputIndex = project.scenes.length;
    const videoLabels = project.scenes.map((_,i)=>`[v${i}]`).join("");
    filterParts.push(`${videoLabels}concat=n=${project.scenes.length}:v=1:a=0[vout]`);
    filterParts.push(`[${audioInputIndex}:a]aresample=44100,apad,atrim=duration=${duration},asetpts=PTS-STARTPTS[aout]`);

    const filterComplex = filterParts.join(";");
    args.push("-filter_complex",filterComplex,
      "-map","[vout]","-map","[aout]",
      "-t",String(duration),
      "-c:v","libx264","-preset","ultrafast","-crf","28",
      "-pix_fmt","yuv420p","-r","30",
      "-c:a","aac","-b:a","128k",
      "-movflags","+faststart",
      "shorts-final.mp4");

    setStatus("MP4を合成中…iPhoneでは数分かかる場合があります。Safariを閉じずにお待ちください。");
    await ffmpeg.exec(args);
    const data = await ffmpeg.readFile("shorts-final.mp4");
    const blob = new Blob([data.buffer], {type:"video/mp4"});
    if (outputURL) URL.revokeObjectURL(outputURL);
    outputURL = URL.createObjectURL(blob);
    $("resultVideo").src = outputURL;
    $("downloadLink").href = outputURL;
    $("outputArea").hidden = false;
    $("progress").value = 100;
    setStatus(`完成：${duration}秒のMP4を生成しました。再生確認後、ダウンロードしてください。`);
  } catch (err) {
    console.error(err);
    setStatus(`処理できませんでした：${err?.message || err}\n画像を減らす／Safariを再起動する／通信を確認する／音声付きMP4やMP3に変換して再試行してください。`);
  } finally {
    $("renderBtn").disabled = false;
  }
}

$("parseBtn").addEventListener("click", () => {
  try { parseJSON(); } catch (e) { setStatus(`JSONエラー：${e.message}`); }
});
$("sampleBtn").addEventListener("click", () => {
  $("jsonInput").value = JSON.stringify(SAMPLE,null,2);
  try { parseJSON(); } catch (e) { setStatus(`JSONエラー：${e.message}`); }
});
$("renderBtn").addEventListener("click", renderVideo);
$("saveJsonBtn").addEventListener("click", () => {
  const blob = new Blob([$("jsonInput").value], {type:"application/json;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href=url; a.download="project.json"; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
});
try { parseJSON(); } catch(e) { setStatus(e.message); }
