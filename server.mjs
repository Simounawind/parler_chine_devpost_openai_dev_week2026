import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const port = Number(process.env.PORT || 3000);
const apiKey = process.env.OPENAI_API_KEY;
const model = process.env.OPENAI_MODEL || "gpt-5.6";
const publicDir = join(process.cwd(), "public");

const scenarios = {
  apartment: {
    title: "Appartement 路 Visiting a flat",
    context: "You are viewing a studio in Lyon. Ask about the rent, charges, and whether the flat is still available.",
    goal: "Confirm the availability and ask one practical question.",
    vocabulary: ["le loyer", "les charges", "disponible", "le dossier"]
  },
  pharmacy: {
    title: "Pharmacie 路 Explaining a symptom",
    context: "You have a sore throat and an allergy to aspirin. Ask a pharmacist for suitable advice.",
    goal: "Describe one symptom and state your allergy safely.",
    vocabulary: ["mal 脿 la gorge", "allergique 脿", "sans ordonnance", "un m茅dicament"]
  },
  prefecture: {
    title: "Pr茅fecture 路 Residence permit appointment",
    context: "Your appointment is next week, but you are unsure which documents you need to bring.",
    goal: "Ask politely for the required documents and confirm the date.",
    vocabulary: ["un rendez-vous", "un justificatif", "apporter", "renouveler"]
  }
};

const feedbackSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "level", "summaryZh", "transcriptNormalized", "naturalVersion", "issues",
    "pronunciation", "conversationScore", "taskEvidence", "nextTurn", "microDrill"
  ],
  properties: {
    level: { type: "string", enum: ["A1", "A2", "B1", "B2", "C1"] },
    summaryZh: { type: "string" },
    transcriptNormalized: { type: "string" },
    naturalVersion: { type: "string" },
    issues: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["type", "severity", "original", "improved", "explanationZh", "motherTongueTipZh", "impact"],
        properties: {
          type: { type: "string", enum: ["grammar", "word_choice", "register", "communication"] },
          severity: { type: "string", enum: ["blocking", "meaning", "natural"] },
          original: { type: "string" },
          improved: { type: "string" },
          explanationZh: { type: "string" },
          motherTongueTipZh: { type: "string" },
          impact: { type: "string" }
        }
      }
    },
    pronunciation: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["token", "ipa", "observationZh", "drill", "confidence"],
        properties: {
          token: { type: "string" },
          ipa: { type: "string" },
          observationZh: { type: "string" },
          drill: { type: "string" },
          confidence: { type: "string", enum: ["self_check", "transcript_clue"] }
        }
      }
    },
    conversationScore: {
      type: "object",
      additionalProperties: false,
      required: ["goal", "clarity", "politeness", "nextFocus"],
      properties: {
        goal: { type: "integer", minimum: 1, maximum: 5 },
        clarity: { type: "integer", minimum: 1, maximum: 5 },
        politeness: { type: "integer", minimum: 1, maximum: 5 },
        nextFocus: { type: "string" }
      }
    },
    taskEvidence: {
      type: "object",
      additionalProperties: false,
      required: ["completed", "achieved", "missing", "summaryZh"],
      properties: {
        completed: { type: "boolean" },
        achieved: {
          type: "array",
          maxItems: 4,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "evidence"],
            properties: {
              label: { type: "string" },
              evidence: { type: "string" }
            }
          }
        },
        missing: { type: "array", maxItems: 3, items: { type: "string" } },
        summaryZh: { type: "string" }
      }
    },
    nextTurn: {
      type: "object",
      additionalProperties: false,
      required: ["agentFrench", "translationZh", "task"],
      properties: {
        agentFrench: { type: "string" },
        translationZh: { type: "string" },
        task: { type: "string" }
      }
    },
    microDrill: {
      type: "object",
      additionalProperties: false,
      required: ["title", "focus", "instructionsZh", "prompt", "targetSentence", "timeSeconds"],
      properties: {
        title: { type: "string" },
        focus: { type: "string" },
        instructionsZh: { type: "string" },
        prompt: { type: "string" },
        targetSentence: { type: "string" },
        timeSeconds: { type: "integer", minimum: 15, maximum: 90 }
      }
    }
  }
};

function makeDemoFeedback(transcript, scenarioId) {
  const normalized = transcript.trim().replace(/\s+/g, " ");
  const lower = normalized.toLowerCase();
  const genericIssues = [];
  const hasApartmentError = /une appartement|un appartement disponible|c'est disponible/.test(lower);
  const hasVouloir = /je veux/.test(lower);
  const hasTu = /tu peux|tu avez/.test(lower);

  if (hasApartmentError) {
    genericIssues.push({
      type: "grammar", severity: "meaning", original: "une appartement", improved: "un appartement",
      explanationZh: "appartement 鏄槼鎬у悕璇嶏紝鎵€浠ヨ鐢?un銆?,
      motherTongueTipZh: "涓枃娌℃湁鍚嶈瘝闃撮槼鎬э紱鎶婂悕璇嶅拰鍐犺瘝褰撴垚涓€涓瘝鍧楄锛歶n appartement銆?,
      impact: "涓嶅Θ纰嶇悊瑙ｏ紝浣嗗湪绉熸埧浜ゆ祦涓細鏄惧緱鍩虹涓嶇ǔ銆?
    });
  }
  if (hasVouloir) {
    genericIssues.push({
      type: "register", severity: "natural", original: "Je veux鈥?, improved: "Je voudrais鈥?/ Est-ce que je pourrais鈥?,
      explanationZh: "鍦ㄦ湇鍔″満鏅噷锛屾潯浠跺紡 voudrais 姣旂洿闄堝紡 veux 鏇寸ぜ璨屻€佹洿鑷劧銆?,
      motherTongueTipZh: "涓嶈鎶娾€滄垜鎯宠鈥濋€愬瓧缈绘垚 je veux锛涙妸 je voudrais 浣滀负瀹屾暣绀艰矊璇锋眰妯℃澘銆?,
      impact: "瀵规柟鑳界悊瑙ｏ紝浣嗚姘斾細鏄惧緱杩囩洿銆?
    });
  }
  if (hasTu) {
    genericIssues.push({
      type: "register", severity: "meaning", original: "tu", improved: "vous",
      explanationZh: "瀵硅嵂鍓傚笀銆佹埧涓滄垨琛屾斂浜哄憳搴旈粯璁や娇鐢?vous銆?,
      motherTongueTipZh: "涓枃鐨勨€滀綘鈥濅笉鍖哄垎浜茬枏锛涙硶璇厛鍒ゆ柇鍏崇郴锛屽啀鍐冲畾 tu 鎴?vous銆?,
      impact: "闄岀敓姝ｅ紡鍦烘櫙涓彲鑳芥樉寰椾笉澶熷緱浣撱€?
    });
  }
  if (!genericIssues.length) {
    genericIssues.push({
      type: "communication", severity: "natural", original: normalized, improved: normalized + " Pourriez-vous me confirmer, s'il vous pla卯t ?",
      explanationZh: "浣犵殑鏍稿績淇℃伅宸茬粡娓呮锛涘啀鍔犱竴涓‘璁ゅ彞锛岃兘璁╃湡瀹炲姙浜嬪満鏅洿鍙帶銆?,
      motherTongueTipZh: "涓枃甯搁潬璇榛樿瀵规柟浼氬洖搴旓紱娉曡鍔炰簨鏃舵槑纭彁鍑虹‘璁よ姹傛洿鏈夋晥銆?,
      impact: "杩欐槸璁╄〃杈句粠鈥滆兘璇粹€濆崌绾у埌鈥滆兘鍔炴垚浜嬧€濈殑涓€姝ャ€?
    });
  }

  const scenarioFeedback = {
    apartment: {
      naturalVersion: "Bonjour, je voudrais savoir si l'appartement est toujours disponible. Quel est le loyer, charges comprises ?",
      next: "Oui, il est disponible. Vous avez d茅j脿 un dossier de location ?",
      nextZh: "鏄殑锛岃繕鍦ㄣ€傛偍宸茬粡鍑嗗濂界鎴挎潗鏂欎簡鍚楋紵",
      task: "鐢?vous 鍥炵瓟锛屽苟闂鏂归渶瑕佸摢浜涙潗鏂欍€?,
      target: "Pourriez-vous me dire quels documents je dois apporter pour le dossier ?"
    },
    pharmacy: {
      naturalVersion: "Bonjour, j'ai mal 脿 la gorge depuis deux jours et je suis allergique 脿 l'aspirine. Qu'est-ce que vous me conseillez ?",
      next: "Avez-vous de la fi猫vre ou des difficult茅s 脿 respirer ?",
      nextZh: "鎮ㄥ彂鐑ф垨鍛煎惛鍥伴毦鍚楋紵",
      task: "绠€鐭弿杩扮棁鐘讹紱鑻ユ病鏈夛紝璇疯 non锛涗笉瑕佽嚜琛岀储瑕佸鏂硅嵂銆?,
      target: "Non, je n'ai pas de fi猫vre. Est-ce que ce m茅dicament est sans ordonnance ?"
    },
    prefecture: {
      naturalVersion: "Bonjour, j'ai un rendez-vous pour renouveler mon titre de s茅jour la semaine prochaine. Pourriez-vous me confirmer les documents 脿 apporter ?",
      next: "Bien s没r. Quel est le motif de votre demande ?",
      nextZh: "褰撶劧銆傛偍姝ゆ鐢宠鐨勪簨鐢辨槸浠€涔堬紵",
      task: "璇存槑浣犺缁锛屽苟绀艰矊鍦扮‘璁ら绾︽棩鏈熴€?,
      target: "C'est pour renouveler mon titre de s茅jour. Mon rendez-vous est bien mardi prochain 脿 dix heures ?"
    }
  }[scenarioId] || {
    naturalVersion: normalized,
    next: "Pouvez-vous pr茅ciser votre demande ?",
    nextZh: "鎮ㄥ彲浠ヨ鏄庡緱鏇村叿浣撲竴浜涘悧锛?,
    task: "琛ュ厖涓€涓叿浣撲俊鎭€?,
    target: "Pourriez-vous me le confirmer, s'il vous pla卯t ?"
  };

  const evidenceRules = {
    apartment: [
      { label: "\u786e\u8ba4\u662f\u5426\u4ecd\u53ef\u79df", test: /disponible|encore libre|toujours libre/, evidence: "\u4f60\u63d0\u5230\u4e86 disponible\u3002" },
      { label: "\u8be2\u95ee\u79df\u91d1", test: /loyer|combien/, evidence: "\u4f60\u8be2\u95ee\u4e86 loyer / prix\u3002" },
      { label: "\u8be2\u95ee\u6742\u8d39\u6216\u6750\u6599", test: /charge|dossier|document/, evidence: "\u4f60\u5f00\u59cb\u786e\u8ba4\u5b9e\u9645\u79df\u623f\u6761\u4ef6\u3002" }
    ],
    pharmacy: [
      { label: "\u8bf4\u660e\u75c7\u72b6", test: /mal|gorge|fi\u00e8vre|douleur/, evidence: "\u4f60\u7ed9\u51fa\u4e86\u75c7\u72b6\u4fe1\u606f\u3002" },
      { label: "\u8bf4\u660e\u8fc7\u654f\u53f2", test: /allergique|allergie/, evidence: "\u4f60\u4e3b\u52a8\u8bf4\u51fa\u4e86\u8fc7\u654f\u4fe1\u606f\u3002" },
      { label: "\u8be2\u95ee\u5408\u9002\u7684\u975e\u5904\u65b9\u5efa\u8bae", test: /conseil|m\u00e9dicament|ordonnance/, evidence: "\u4f60\u8bf4\u660e\u4e86\u9700\u8981\u836f\u5242\u5e08\u5efa\u8bae\u3002" }
    ],
    prefecture: [
      { label: "\u8bf4\u660e\u5c45\u7559\u529e\u7406\u4e8b\u7531", test: /renouvel|titre de s\u00e9jour/, evidence: "\u4f60\u8bf4\u660e\u4e86\u7eed\u7b7e\u5c45\u7559\u7684\u76ee\u7684\u3002" },
      { label: "\u8be2\u95ee\u6240\u9700\u6587\u4ef6", test: /document|justificatif|apporter/, evidence: "\u4f60\u95ee\u5230\u4e86\u6587\u4ef6\u8981\u6c42\u3002" },
      { label: "\u786e\u8ba4\u9884\u7ea6", test: /rendez-vous|mardi|semaine prochaine|date/, evidence: "\u4f60\u63d0\u5230\u4e86\u9884\u7ea6\u6216\u65e5\u671f\u3002" }
    ]
  }[scenarioId] || [];
  const achieved = evidenceRules.filter(rule => rule.test.test(lower)).map(rule => ({ label: rule.label, evidence: rule.evidence }));
  const missing = evidenceRules.filter(rule => !rule.test.test(lower)).map(rule => rule.label);

  return {
    level: normalized.length > 100 ? "B1" : "A2",
    summaryZh: "浣犲凡缁忔姄浣忎簡鐪熷疄鍔炰簨鐨勬牳蹇冩剰鍥俱€備笅涓€姝ヤ紭鍏堟妸绀艰矊璇锋眰鍜屽叧閿俊鎭粍鍚堟垚瀹屾暣鍙ャ€?,
    transcriptNormalized: normalized,
    naturalVersion: scenarioFeedback.naturalVersion,
    issues: genericIssues.slice(0, 3),
    pronunciation: [{
      token: scenarioId === "apartment" ? "loyer" : "pourriez-vous",
      ipa: scenarioId === "apartment" ? "/lwa.je/" : "/pu.蕘je vu/",
      observationZh: "杩欐槸鍩轰簬鏂囨湰鐨勭粌涔犳彁閱掞紝涓嶆槸澹板鍒ゅ垎銆傚厛鎱㈤€熷惉璇伙紝鍐嶅綍涓嬭嚜宸变笌鍙傝€冮煶瀵规瘮銆?,
      drill: scenarioId === "apartment" ? "loi 鈫?loyer锛涙敞鎰?oi 鏄?/wa/銆? : "pour-rriez-vous锛氭妸 /蕘/ 鏀惧湪鍠夐儴杞绘懇鎿︼紝涓嶈鏇挎垚涓枃 r銆?,
      confidence: "self_check"
    }],
    conversationScore: {
      goal: normalized.length > 30 ? 4 : 3,
      clarity: normalized.length > 45 ? 4 : 3,
      politeness: hasVouloir || hasTu ? 2 : 4,
      nextFocus: genericIssues[0].improved
    },
    taskEvidence: {
      completed: missing.length === 0,
      achieved: achieved.length ? achieved : [{ label: "\u8868\u8fbe\u4e86\u6c42\u52a9\u610f\u56fe", evidence: "\u4f60\u5df2\u7ecf\u5f00\u53e3\u8fdb\u5165\u4e86\u8fd9\u4e2a\u573a\u666f\u3002" }],
      missing,
      summaryZh: missing.length === 0
        ? "\u4efb\u52a1\u4fe1\u606f\u5df2\u7ecf\u5b8c\u6574\uff1a\u5bf9\u65b9\u6709\u8db3\u591f\u7ebf\u7d22\u7ee7\u7eed\u4e3a\u4f60\u529e\u7406\u3002"
        : `\u4f60\u5df2\u7ecf\u5b8c\u6210 ${achieved.length}/${evidenceRules.length} \u4e2a\u5173\u952e\u4fe1\u606f\u70b9\uff1b\u4e0b\u4e00\u53e5\u4f18\u5148\u8865\u4e0a\u201c${missing[0]}\u201d\u3002`
    },
    nextTurn: { agentFrench: scenarioFeedback.next, translationZh: scenarioFeedback.nextZh, task: scenarioFeedback.task },
    microDrill: {
      title: "30 绉掓渶灏忎慨澶?,
      focus: genericIssues[0].improved,
      instructionsZh: "鍏堝惉鐩爣鍙ワ紝鍐嶄笉鐪嬫枃瀛楀杩颁袱閬嶃€傜浜岄亶鍙敼杩欎竴澶勶紝涓嶈拷姹傚畬缇庛€?,
      prompt: "鐜板湪璇锋妸杩欏彞璇濊嚜鐒跺湴璇村嚭鏉ワ細",
      targetSentence: scenarioFeedback.target,
      timeSeconds: 30
    }
  };
}

function responseText(response) {
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output || []) {
    for (const content of item.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  throw new Error("The model returned no text output.");
}

async function analyzeWithOpenAI(transcript, scenarioId, studentName) {
  const scenario = scenarios[scenarioId];
  const instructions = `You are Parler Chine, a careful French speaking coach for Mandarin speakers living in France. Give supportive, specific coaching in Simplified Chinese and French. Focus on successful real-world communication, not academic perfection. The learner's spoken French was transcribed; NEVER claim acoustic or phoneme certainty from the transcript. Pronunciation entries must be self_check or transcript_clue only. Do not give medical advice beyond encouraging a pharmacist or emergency professional when relevant. Correct at most three high-impact issues. Preserve the learner's meaning. For taskEvidence, identify only information explicitly present in the learner's words; this is task-completion evidence, not a grammar score. Return only the requested JSON.`;
  const input = `Learner: ${studentName || "student"}\nScenario: ${scenario.title}\nContext: ${scenario.context}\nGoal: ${scenario.goal}\nUseful vocabulary: ${scenario.vocabulary.join(", ")}\n\nLearner transcript:\n${transcript}`;
  const result = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      instructions,
      input,
      text: { format: { type: "json_schema", name: "speaking_coach_feedback", strict: true, schema: feedbackSchema } }
    })
  });
  if (!result.ok) {
    const detail = (await result.text()).slice(0, 300);
    throw new Error(`OpenAI request failed (${result.status}): ${detail}`);
  }
  return JSON.parse(responseText(await result.json()));
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

async function parseBody(req) {
  let raw = "";
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 50_000) throw new Error("Request too large");
  }
  return JSON.parse(raw || "{}");
}

const mime = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/config") return sendJson(res, 200, { liveMode: Boolean(apiKey), model });
    if (req.method === "GET" && url.pathname === "/api/health") return sendJson(res, 200, { status: "ok", mode: apiKey ? "live" : "demo" });
    if (req.method === "POST" && url.pathname === "/api/analyze") {
      const { transcript, scenarioId, studentName } = await parseBody(req);
      if (typeof transcript !== "string" || transcript.trim().length < 3) return sendJson(res, 400, { error: "Please provide a French response of at least three characters." });
      if (!scenarios[scenarioId]) return sendJson(res, 400, { error: "Unknown scenario." });
      const feedback = apiKey
        ? await analyzeWithOpenAI(transcript.trim(), scenarioId, typeof studentName === "string" ? studentName.slice(0, 60) : "")
        : makeDemoFeedback(transcript.trim(), scenarioId);
      return sendJson(res, 200, { mode: apiKey ? "live" : "demo", feedback });
    }

    if (req.method !== "GET") return sendJson(res, 405, { error: "Method not allowed" });
    const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    const file = normalize(join(publicDir, requested));
    if (!file.startsWith(publicDir)) return sendJson(res, 403, { error: "Forbidden" });
    const content = await readFile(file);
    res.writeHead(200, { "Content-Type": mime[extname(file)] || "application/octet-stream" });
    res.end(content);
  } catch (error) {
    const status = error instanceof SyntaxError ? 400 : 500;
    sendJson(res, status, { error: error.message || "Unexpected server error" });
  }
});

server.listen(port, () => {
  console.log(`Parler Chine running at http://localhost:${port} (${apiKey ? `live ${model}` : "demo mode"})`);
});
