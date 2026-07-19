const scenarios = [
  { id: "apartment", index: "01", emoji: "鈱?, title: "鐪嬫埧涓庣鎴?, subtitle: "閲屾槀 路 Appartement", context: "浣犳鍦ㄩ噷鏄傜湅涓€濂?studio銆傞棶绉熼噾銆佹潅璐癸紝浠ュ強鎴垮瓙鏄惁杩樺湪鍑虹銆?, goal: "纭鏄惁鍙锛屽苟闂竴涓疄闄呴棶棰樸€?, vocabulary: ["le loyer", "les charges", "disponible", "le dossier"], example: "Bonjour, je veux louer une appartement. C'est disponible ? Et combien pour le loyer ?" },
  { id: "pharmacy", index: "02", emoji: "鉁?, title: "鍦ㄨ嵂搴楄鏄庣棁鐘?, subtitle: "宸撮粠 路 Pharmacie", context: "浣犲棑瀛愮柤锛屽苟涓斿闃垮徃鍖规灄杩囨晱銆傚悜鑽墏甯堣鏄庢儏鍐靛苟璇㈤棶寤鸿銆?, goal: "璇存槑涓€涓棁鐘讹紝骞跺畨鍏ㄥ湴鍛婄煡杩囨晱鍙层€?, vocabulary: ["mal 脿 la gorge", "allergique 脿", "sans ordonnance", "un m茅dicament"], example: "Bonjour, je veux un m茅dicament. J'ai mal 脿 la gorge et je suis allergique 脿 l'aspirine." },
  { id: "prefecture", index: "03", emoji: "鈻?, title: "鍘?pr茅fecture 鍔炰簨", subtitle: "琛屾斂 路 Titre de s茅jour", context: "浣犵殑灞呯暀棰勭害鍦ㄤ笅鍛紝浣嗕綘涓嶇‘瀹氶渶瑕佸甫鍝簺鏂囦欢銆?, goal: "绀艰矊璇㈤棶鎵€闇€鏉愭枡锛屽苟纭棰勭害鏃堕棿銆?, vocabulary: ["un rendez-vous", "un justificatif", "apporter", "renouveler"], example: "Bonjour, je veux renouveler mon titre de s茅jour. Quels documents je dois apporter ?" }
];

const elements = {
  grid: document.querySelector("#scenario-grid"), transcript: document.querySelector("#transcript"), record: document.querySelector("#record-button"), recordLabel: document.querySelector("#record-label"), status: document.querySelector("#speech-status"), analyze: document.querySelector("#analyze-button"), feedback: document.querySelector("#feedback"), mode: document.querySelector("#mode-pill"), missionNumber: document.querySelector("#mission-number"), missionTitle: document.querySelector("#mission-title"), missionContext: document.querySelector("#mission-context"), missionGoal: document.querySelector("#mission-goal"), vocabulary: document.querySelector("#vocabulary"), summary: document.querySelector("#feedback-summary"), original: document.querySelector("#original-line"), natural: document.querySelector("#natural-line"), issues: document.querySelector("#issues-list"), pronunciation: document.querySelector("#pronunciation-list"), drill: document.querySelector("#micro-drill"), agentLine: document.querySelector("#agent-line"), agentTranslation: document.querySelector("#agent-translation"), nextTask: document.querySelector("#next-task"), goalScore: document.querySelector("#goal-score"), taskEvidence: document.querySelector("#task-evidence"), playRecording: document.querySelector("#play-recording"), labState: document.querySelector("#lab-state"), waveform: document.querySelector("#waveform"), spectrogram: document.querySelector("#spectrogram"), pitchCanvas: document.querySelector("#pitch-canvas"), labDuration: document.querySelector("#lab-duration"), labVoiceRatio: document.querySelector("#lab-voice-ratio"), labPitch: document.querySelector("#lab-pitch"), labPauses: document.querySelector("#lab-pauses"), sessionCount: document.querySelector("#session-count"), mapBars: document.querySelector("#map-bars"), mapEmpty: document.querySelector("#map-empty")
};

let activeScenario = scenarios[0];
let latestFeedback;
let recognition;
let recognitionRunning = false;
let isRecording = false;
let lab = null;
let studentRecordingUrl = null;
const profileKey = "parler-chine-profile-v1";
let profile = JSON.parse(localStorage.getItem(profileKey) || '{"sessions":0,"focus":{}}');

function escapeHtml(value) { return String(value).replace(/[&<>"]/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[char]); }
function speak(text) { if (!window.speechSynthesis) return; window.speechSynthesis.cancel(); const utterance = new SpeechSynthesisUtterance(text); utterance.lang = "fr-FR"; utterance.rate = 0.84; window.speechSynthesis.speak(utterance); }


function setRecordingUi(recording) {
  elements.record.setAttribute("aria-pressed", String(recording));
  elements.record.classList.toggle("recording", recording);
  elements.recordLabel.textContent = recording ? "Recording locally... click to finish" : "\u7528\u6cd5\u8bed\u8bf4";
}
function setLabState(text, recording = false) { elements.labState.textContent = text; elements.labState.classList.toggle("recording", recording); }
function resetCanvas(canvas) {
  const ctx = canvas.getContext("2d"); ctx.fillStyle = "#102f40"; ctx.fillRect(0, 0, canvas.width, canvas.height); ctx.strokeStyle = "rgba(183,216,229,.14)"; ctx.lineWidth = 1;
  for (let y = 18; y < canvas.height; y += 22) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke(); }
  return ctx;
}
function clearSpeechLab() { [elements.waveform, elements.spectrogram, elements.pitchCanvas].forEach(resetCanvas); elements.labDuration.textContent = "?"; elements.labVoiceRatio.textContent = "?"; elements.labPitch.textContent = "?"; elements.labPauses.textContent = "?"; }
function drawWaveform(values) {
  const ctx = resetCanvas(elements.waveform); const { width, height } = elements.waveform; ctx.strokeStyle = "#edbd57"; ctx.lineWidth = 2; ctx.beginPath();
  for (let index = 0; index < values.length; index += 1) { const x = index / (values.length - 1) * width; const y = (0.5 + values[index] * 2.2) * height; index ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
  ctx.stroke();
}
function drawSpectrum(values, sampleRate) {
  const canvas = elements.spectrogram; const ctx = canvas.getContext("2d"); ctx.drawImage(canvas, -2, 0, canvas.width - 2, canvas.height, 0, 0, canvas.width - 2, canvas.height);
  const binHz = sampleRate / (values.length * 2);
  for (let row = 0; row < 72; row += 1) { const ratio = row / 71; const hz = 80 * Math.pow(4000 / 80, 1 - ratio); const index = Math.min(values.length - 1, Math.max(1, Math.round(hz / binHz))); const energy = values[index] / 255; const hue = 210 - energy * 165; ctx.fillStyle = `hsl(${hue} 82% ${18 + energy * 58}%)`; ctx.fillRect(canvas.width - 2, row / 72 * canvas.height, 2, canvas.height / 72 + 1); }
}
function drawPitch(frames) {
  const ctx = resetCanvas(elements.pitchCanvas); const { width, height } = elements.pitchCanvas; const visible = frames.slice(-360); if (!visible.some(frame => frame.pitch > 0)) return; ctx.strokeStyle = "#80d2ad"; ctx.lineWidth = 2; ctx.beginPath(); let drawing = false;
  visible.forEach((frame, index) => { if (!frame.pitch) { drawing = false; return; } const x = index / Math.max(1, visible.length - 1) * width; const y = height - Math.max(0, Math.min(1, (frame.pitch - 75) / 285)) * height; if (drawing) ctx.lineTo(x, y); else { ctx.moveTo(x, y); drawing = true; } });
  ctx.stroke(); ctx.fillStyle = "#9bbac5"; ctx.font = "10px sans-serif"; ctx.fillText("75 Hz", 6, height - 6); ctx.fillText("360 Hz", 6, 12);
}
function estimatePitch(buffer, sampleRate) {
  let mean = 0; for (let index = 0; index < buffer.length; index += 1) mean += buffer[index]; mean /= buffer.length; let energy = 0; for (let index = 0; index < buffer.length; index += 1) energy += (buffer[index] - mean) ** 2; if (Math.sqrt(energy / buffer.length) < 0.012) return 0;
  const minLag = Math.floor(sampleRate / 360); const maxLag = Math.min(Math.floor(sampleRate / 75), Math.floor(buffer.length / 2)); let bestLag = 0; let bestCorrelation = 0;
  for (let lag = minLag; lag <= maxLag; lag += 1) { let cross = 0; let firstEnergy = 0; let secondEnergy = 0; for (let index = 0; index < buffer.length - lag; index += 1) { const first = buffer[index] - mean; const second = buffer[index + lag] - mean; cross += first * second; firstEnergy += first * first; secondEnergy += second * second; } const correlation = cross / Math.sqrt(firstEnergy * secondEnergy || 1); if (correlation > bestCorrelation) { bestCorrelation = correlation; bestLag = lag; } }
  return bestCorrelation > 0.58 ? sampleRate / bestLag : 0;
}
function median(values) { if (!values.length) return 0; const sorted = [...values].sort((a, b) => a - b); const middle = Math.floor(sorted.length / 2); return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2; }
function countPauses(frames) { const threshold = 0.016; const minimumFrames = 18; let run = 0; let pauses = 0; let heardVoice = false; for (const frame of frames) { if (frame.rms >= threshold) { if (heardVoice && run >= minimumFrames) pauses += 1; heardVoice = true; run = 0; } else if (heardVoice) run += 1; } return pauses; }
function summarizeSpeechLab(finishedLab) {
  const frames = finishedLab.frames; const duration = frames.length ? frames.at(-1).time / 1000 : 0; const voiced = frames.filter(frame => frame.pitch > 0); const voicedRatio = frames.length ? Math.round(voiced.length / frames.length * 100) : 0; const medianPitch = median(voiced.map(frame => frame.pitch)); const pauses = countPauses(frames);
  elements.labDuration.textContent = duration ? `${duration.toFixed(1)} s` : "?"; elements.labVoiceRatio.textContent = duration ? `${voicedRatio}%` : "?"; elements.labPitch.textContent = medianPitch ? `${Math.round(medianPitch)} Hz` : "?"; elements.labPauses.textContent = duration ? String(pauses) : "?";
  if (!duration) setLabState("No usable signal captured"); else if (duration < 2) setLabState("Try one longer turn for rhythm feedback"); else if (voicedRatio < 24) setLabState("Signal is quiet; move closer to the mic"); else setLabState(`Local summary ready ? ${pauses ? "notice pauses" : "steady flow"}`);
}
function tickSpeechLab() {
  if (!lab) return; lab.analyser.getFloatTimeDomainData(lab.timeData); lab.analyser.getByteFrequencyData(lab.frequencyData); let energy = 0; for (const value of lab.timeData) energy += value * value; const rms = Math.sqrt(energy / lab.timeData.length); const pitch = estimatePitch(lab.timeData, lab.context.sampleRate); const elapsed = performance.now() - lab.startedAt;
  lab.frames.push({ time: elapsed, rms, pitch }); if (lab.frames.length > 5400) lab.frames.shift(); drawWaveform(lab.timeData); drawSpectrum(lab.frequencyData, lab.context.sampleRate); drawPitch(lab.frames); lab.animationFrame = requestAnimationFrame(tickSpeechLab);
}
async function startSpeechLab() {
  if (!navigator.mediaDevices?.getUserMedia || !(window.AudioContext || window.webkitAudioContext)) { setLabState("Audio capture is unavailable in this browser"); return false; }
  clearSpeechLab(); setLabState("Requesting microphone permission..."); const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false } }); const AudioContextConstructor = window.AudioContext || window.webkitAudioContext; const context = new AudioContextConstructor(); if (context.state === "suspended") await context.resume(); const analyser = context.createAnalyser(); analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.72; const source = context.createMediaStreamSource(stream); source.connect(analyser);
  const currentLab = { stream, context, analyser, source, timeData: new Float32Array(analyser.fftSize), frequencyData: new Uint8Array(analyser.frequencyBinCount), frames: [], startedAt: performance.now(), animationFrame: 0, timeout: 0, recorder: null, chunks: [] };
  if (window.MediaRecorder) { currentLab.recorder = new MediaRecorder(stream); currentLab.recorder.addEventListener("dataavailable", event => { if (event.data.size) currentLab.chunks.push(event.data); }); currentLab.recorder.addEventListener("stop", () => { if (!currentLab.chunks.length) return; if (studentRecordingUrl) URL.revokeObjectURL(studentRecordingUrl); studentRecordingUrl = URL.createObjectURL(new Blob(currentLab.chunks, { type: currentLab.recorder.mimeType || "audio/webm" })); elements.playRecording.disabled = false; }); currentLab.recorder.start(250); }
  lab = currentLab; currentLab.timeout = window.setTimeout(() => { if (lab === currentLab) stopPracticeCapture("90-second local capture limit reached."); }, 90000); setLabState("Recording locally ? audio never leaves this tab", true); tickSpeechLab(); return true;
}
function stopSpeechLab() { if (!lab) return; const finishedLab = lab; lab = null; cancelAnimationFrame(finishedLab.animationFrame); clearTimeout(finishedLab.timeout); if (finishedLab.recorder && finishedLab.recorder.state !== "inactive") finishedLab.recorder.stop(); finishedLab.source.disconnect(); finishedLab.stream.getTracks().forEach(track => track.stop()); finishedLab.context.close(); summarizeSpeechLab(finishedLab); }
async function startPracticeCapture() {
  elements.record.disabled = true; let audioReady = false; try { audioReady = await startSpeechLab(); } catch (error) { setLabState("Microphone unavailable"); elements.status.textContent = `\u65e0\u6cd5\u6253\u5f00\u9ea6\u514b\u98ce\uff1a${error.name || error.message}`; }
  if (recognition) { try { recognition.start(); } catch { elements.status.textContent = "\u53ef\u4ee5\u7ee7\u7eed\u672c\u5730\u5f55\u97f3\uff0c\u6216\u76f4\u63a5\u8f93\u5165\u6cd5\u8bed\u3002"; } }
  isRecording = audioReady || Boolean(recognition); setRecordingUi(isRecording); if (isRecording && audioReady) elements.status.textContent = "\u8bf7\u81ea\u7136\u5730\u8bf4\u6cd5\u8bed\uff1b\u97f3\u9891\u4ec5\u5728\u672c\u673a\u8ba1\u7b97\u3002"; elements.record.disabled = false;
}
function stopPracticeCapture(reason = "") { if (recognition && recognitionRunning) { try { recognition.stop(); } catch { /* recognition has already stopped */ } } recognitionRunning = false; stopSpeechLab(); isRecording = false; setRecordingUi(false); if (reason) elements.status.textContent = reason; }

function renderScenarios() {
  elements.grid.innerHTML = "";
  const template = document.querySelector("#scenario-template");
  scenarios.forEach(scenario => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.dataset.id = scenario.id;
    node.querySelector(".scenario-index").textContent = scenario.index;
    node.querySelector(".scenario-emoji").textContent = scenario.emoji;
    node.querySelector("strong").textContent = scenario.title;
    node.querySelector("small").textContent = scenario.subtitle;
    node.classList.toggle("selected", scenario.id === activeScenario.id);
    node.addEventListener("click", () => selectScenario(scenario.id));
    elements.grid.append(node);
  });
}

function selectScenario(id) {
  activeScenario = scenarios.find(scenario => scenario.id === id);
  elements.missionNumber.textContent = activeScenario.index;
  elements.missionTitle.textContent = activeScenario.title;
  elements.missionContext.textContent = activeScenario.context;
  elements.missionGoal.textContent = activeScenario.goal;
  elements.vocabulary.innerHTML = activeScenario.vocabulary.map(word => `<span>${word}</span>`).join("");
  elements.transcript.value = "";
  elements.feedback.hidden = true;
  renderScenarios();
}

function renderProfile() {
  elements.sessionCount.textContent = `${profile.sessions} 娆;
  const entries = Object.entries(profile.focus).sort((a, b) => b[1] - a[1]);
  elements.mapEmpty.hidden = Boolean(entries.length);
  elements.mapBars.innerHTML = entries.slice(0, 4).map(([key, value]) => `<div class="map-row"><span>${escapeHtml(key)}</span><div><i style="width:${Math.min(100, value * 25)}%"></i></div><b>${value}</b></div>`).join("");
}

function updateProfile(feedback) {
  profile.sessions += 1;
  feedback.issues.forEach(issue => { profile.focus[issue.improved] = (profile.focus[issue.improved] || 0) + 1; });
  localStorage.setItem(profileKey, JSON.stringify(profile));
  renderProfile();
}

function severityText(severity) { return ({ blocking: "褰卞搷娌熼€?, meaning: "浼樺厛淇", natural: "鏇磋嚜鐒? })[severity] || "寤鸿"; }
function renderFeedback(feedback) {
  latestFeedback = feedback;
  elements.summary.innerHTML = `<p><b>${feedback.level}</b> ${escapeHtml(feedback.summaryZh)}</p><div class="metric-list"><span>?? ${feedback.conversationScore.goal}/5</span><span>?? ${feedback.conversationScore.clarity}/5</span><span>?? ${feedback.conversationScore.politeness}/5</span></div>`;
  const taskEvidence = feedback.taskEvidence || { completed: false, achieved: [], missing: [], summaryZh: "\u672a\u751f\u6210\u4efb\u52a1\u8bc1\u636e\u3002" };
  const achievedMarkup = taskEvidence.achieved.map(item => `<div class="evidence-item"><span>?</span>${escapeHtml(item.label)}<small>${escapeHtml(item.evidence)}</small></div>`).join("");
  const missingMarkup = taskEvidence.missing.map(item => `<div class="evidence-item missing"><span>?</span>${escapeHtml(item)}</div>`).join("");
  elements.taskEvidence.innerHTML = `<div><span class="card-kicker">MISSION EVIDENCE</span><h3>${taskEvidence.completed ? "\u4efb\u52a1\u4fe1\u606f\u5b8c\u6574" : "\u518d\u8865\u4e00\u4e2a\u5173\u952e\u4fe1\u606f"}</h3><p>${escapeHtml(taskEvidence.summaryZh)}</p></div><div class="evidence-list">${achievedMarkup}${missingMarkup}</div>`;
  elements.original.textContent = `浣犺锛?{feedback.transcriptNormalized}`;
  elements.natural.textContent = feedback.naturalVersion;
  elements.goalScore.textContent = `${feedback.conversationScore.goal}/5`;
  elements.issues.innerHTML = feedback.issues.map(issue => `<article class="issue"><div><span class="severity ${issue.severity}">${severityText(issue.severity)}</span><p><del>${escapeHtml(issue.original)}</del> <strong>${escapeHtml(issue.improved)}</strong></p></div><p>${escapeHtml(issue.explanationZh)}</p><aside><b>涓枃姣嶈杩佺Щ锛?/b>${escapeHtml(issue.motherTongueTipZh)}</aside></article>`).join("");
  elements.pronunciation.innerHTML = feedback.pronunciation.map(item => `<article class="pronunciation"><p><b>${escapeHtml(item.token)}</b> <span>${escapeHtml(item.ipa)}</span></p><p>${escapeHtml(item.observationZh)}</p><p class="drill-line">缁冩硶锛?{escapeHtml(item.drill)}</p></article>`).join("");
  elements.drill.innerHTML = `<div><span class="card-kicker">${feedback.microDrill.timeSeconds} SECOND REPAIR</span><h3>${escapeHtml(feedback.microDrill.title)} 路 ${escapeHtml(feedback.microDrill.focus)}</h3><p>${escapeHtml(feedback.microDrill.instructionsZh)}</p></div><div class="drill-target"><span>${escapeHtml(feedback.microDrill.prompt)}</span><strong lang="fr">${escapeHtml(feedback.microDrill.targetSentence)}</strong><button class="audio-button" id="listen-drill">鈻?鍚竴閬?/button></div>`;
  elements.agentLine.textContent = `鈥?{feedback.nextTurn.agentFrench}鈥漙;
  elements.agentTranslation.textContent = feedback.nextTurn.translationZh;
  elements.nextTask.textContent = feedback.nextTurn.task;
  elements.feedback.hidden = false;
  elements.feedback.scrollIntoView({ behavior: "smooth", block: "start" });
  document.querySelector("#listen-drill").addEventListener("click", () => speak(feedback.microDrill.targetSentence));
  updateProfile(feedback);
}

async function analyze() {
  const transcript = elements.transcript.value.trim();
  if (transcript.length < 3) { elements.status.textContent = "鍏堣鎴栬緭鍏ヤ竴鍙ユ硶璇紝鍐嶈幏寰楀弽棣堛€?; elements.transcript.focus(); return; }
  elements.analyze.disabled = true;
  elements.analyze.innerHTML = "姝ｅ湪鐞嗚В浣犵殑鎰忓浘鈥?;
  try {
    const response = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ transcript, scenarioId: activeScenario.id }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "鍒嗘瀽鏆傛椂涓嶅彲鐢ㄣ€?);
    renderFeedback(data.feedback);
    elements.status.textContent = data.mode === "live" ? "宸茬敱 GPT-5.6 鐢熸垚鍙嶉" : "婕旂ず妯″紡锛氬弽棣堝彲澶嶇幇";
  } catch (error) { elements.status.textContent = `鏈兘鐢熸垚鍙嶉锛?{error.message}`; }
  finally { elements.analyze.disabled = false; elements.analyze.innerHTML = "鑾峰緱鍙嶉 <span>鈫?/span>"; }
}

function setupRecognition() {
  const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!Recognition) { elements.status.textContent = "\u8bed\u97f3\u8f6c\u5199\u5728\u6b64\u6d4f\u89c8\u5668\u4e0d\u53ef\u7528\uff1b\u4f60\u4ecd\u53ef\u4ee5\u5f55\u97f3\u505a\u672c\u5730\u58f0\u5b66\u590d\u76d8\u6216\u76f4\u63a5\u8f93\u5165\u6cd5\u8bed\u3002"; return; }
  recognition = new Recognition(); recognition.lang = "fr-FR"; recognition.interimResults = true; recognition.continuous = false;
  let finalText = "";
  recognition.onstart = () => { recognitionRunning = true; };
  recognition.onresult = event => { let interim = ""; for (let index = event.resultIndex; index < event.results.length; index += 1) { if (event.results[index].isFinal) finalText += event.results[index][0].transcript; else interim += event.results[index][0].transcript; } elements.transcript.value = finalText || interim; };
  recognition.onerror = event => { recognitionRunning = false; elements.status.textContent = `\u8bed\u97f3\u8f6c\u5199\u672a\u5b8c\u6210\uff1a${event.error}\u3002\u5f55\u97f3\u4ecd\u53ef\u7528\u4e8e\u672c\u5730\u58f0\u5b66\u590d\u76d8\uff1b\u4e5f\u53ef\u6539\u4e3a\u6587\u5b57\u8f93\u5165\u3002`; };
  recognition.onend = () => { recognitionRunning = false; if (isRecording) elements.status.textContent = elements.transcript.value ? "\u5df2\u5f97\u5230\u8f6c\u5199\uff1b\u53ef\u7ee7\u7eed\u672c\u5730\u5f55\u97f3\uff0c\u6216\u70b9\u51fb\u9ea6\u514b\u98ce\u7ed3\u675f\u3002" : "\u8f6c\u5199\u5df2\u505c\u6b62\uff1b\u53ef\u7ee7\u7eed\u5f55\u97f3\u6216\u76f4\u63a5\u8f93\u5165\u6cd5\u8bed\u3002"; };
}

elements.record.addEventListener("click", () => { if (isRecording) stopPracticeCapture(); else startPracticeCapture(); });
elements.playRecording.addEventListener("click", () => { if (!studentRecordingUrl) return; const player = new Audio(studentRecordingUrl); player.play().catch(() => { elements.status.textContent = "\u65e0\u6cd5\u56de\u542c\u5f55\u97f3\uff1b\u8bf7\u68c0\u67e5\u6d4f\u89c8\u5668\u7684\u97f3\u9891\u6743\u9650\u3002"; }); });

document.querySelector("#load-example").addEventListener("click", () => { elements.transcript.value = activeScenario.example; document.querySelector("#practice").scrollIntoView({ behavior: "smooth" }); elements.status.textContent = "\u5df2\u8f7d\u5165\u6545\u610f\u5305\u542b\u5178\u578b\u9519\u8bef\u7684\u6f14\u793a\u56de\u7b54\u3002"; });
document.querySelector("#listen-input").addEventListener("click", () => speak(activeScenario.example));
document.querySelector("#listen-natural").addEventListener("click", () => latestFeedback && speak(latestFeedback.naturalVersion));
document.querySelector("#try-next-turn").addEventListener("click", () => { elements.transcript.value = ""; document.querySelector("#practice").scrollIntoView({ behavior: "smooth" }); elements.transcript.focus(); elements.status.textContent = latestFeedback?.nextTurn.task || "缁х画浣犵殑瀵硅瘽銆?; });
document.querySelector("#reset-profile").addEventListener("click", () => { profile = { sessions: 0, focus: {} }; localStorage.setItem(profileKey, JSON.stringify(profile)); renderProfile(); });
elements.analyze.addEventListener("click", analyze);

async function getConfig() { try { const response = await fetch("/api/config"); const config = await response.json(); elements.mode.textContent = config.liveMode ? `GPT-5.6 路 Live feedback` : "Demo mode 路 no key needed"; elements.mode.classList.toggle("live", config.liveMode); } catch { elements.mode.textContent = "Local mode"; } }
clearSpeechLab(); selectScenario("apartment"); renderProfile(); setupRecognition(); getConfig();
