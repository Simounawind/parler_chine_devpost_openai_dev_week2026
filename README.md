# Parler Chine

> **A real-life French speaking coach for Mandarin speakers living in France.**

![Parler Chine screenshot placeholder](docs/screenshot-placeholder.svg)

Parler Chine helps a learner do something concrete in France: visit a flat, explain a symptom at a pharmacy, or prepare a residence-permit appointment. Instead of producing a long, generic correction, it gives one conversational turn, a small number of high-impact repairs, an explanation of the Mandarin-to-French transfer behind the mistake, and a 30-second repair drill.

Built for the **OpenAI Build Week Challenge 鈥?Education track**.

## Demo video

Watch the public Build Week demo: [Parler Chine on YouTube](https://www.youtube.com/watch?v=-W4St9Fp--Q)

## Why it exists

Many Chinese learners can translate a French sentence on paper but freeze in administrative, housing, and health-related interactions. The real problem is not a lack of vocabulary alone:

- Chinese does not encode grammatical gender, verb inflection, or `tu`/`vous` social distance in the same way French does.
- Existing chatbots tend to correct every detail, which makes speaking feel like a test instead of a conversation.
- A transcript alone cannot honestly establish whether a learner produced an exact French phoneme, yet many products make overly precise pronunciation claims.

Parler Chine is designed around a different question: **could the learner accomplish the task, and what is the smallest correction that will make the next turn work better?**

## What works today

The submitted MVP is a polished single-page web app with three France-based speaking simulations:

1. **Apartment visit** 鈥?availability, rent, charges, and rental documents.
2. **Pharmacy** 鈥?describing a sore throat and disclosing an aspirin allergy. The app intentionally avoids medical diagnosis.
3. **Pr茅fecture appointment** 鈥?asking which documents are needed for a residence-permit renewal.

For each answer, the app provides:

- French browser speech recognition (`fr-FR`) when the browser exposes it, plus an always-available text input fallback.
- A normalized learner transcript and a more natural French version that preserves their intent.
- At most three high-impact grammar, word-choice, register, or communication repairs.
- A Mandarin-specific explanation for each repair.
- A clearly labelled **pronunciation checkpoint**: listen/record/compare practice, not an unsupported acoustic score.
- A 30-second micro-drill and a plausible next conversational turn.
- A browser-local 鈥淐hinese learner map鈥?that counts patterns to revisit in future sessions.

The app runs in two deliberately visible modes:

| Mode | When used | Purpose |
| --- | --- | --- |
| **Demo mode** | Default; no key is needed | Deterministic feedback for the built-in sample answers, so judges can test it immediately and repeatably. |
| **GPT-5.6 live feedback** | `OPENAI_API_KEY` is configured | The server calls the OpenAI Responses API with a strict JSON Schema and adapts feedback to the learner's actual answer. |

## Product decisions

### 1. Situation before syllabus

The scenarios are written around things an immigrant learner needs to accomplish, not textbook chapter headings. Every scenario includes one measurable objective and intentionally small vocabulary support.

### 2. Repair, do not replace

The coach preserves the learner's intent, corrects no more than three issues, states the effect on real communication, and asks the learner to continue. That makes the interaction feel like rehearsal rather than answer generation.

### 3. Mandarin-transfer feedback

Each repair has a `motherTongueTipZh` field. It explains a likely transfer 鈥?for example, lack of grammatical gender, the absence of a `tu`/`vous` distinction, or literal translation of 鈥滄垜鎯宠鈥?as `je veux` 鈥?then offers a chunk to remember.

### 4. Honest pronunciation scope

No spectrogram or transcript-only system can reliably decide whether someone produced a French phoneme correctly. This MVP therefore labels its output as a **pronunciation checkpoint** and provides reference audio through the browser's speech synthesis plus a narrow listening/repetition drill.

An evidence-based next iteration could:

1. capture consented audio in the browser;
2. use a speech/transcription service with word timestamps;
3. align learner audio to a reference sentence with a dedicated forced-alignment or phoneme-assessment service;
4. visualise only the timing or features that the scorer actually supports.

A waveform or spectrogram is useful as a reflection tool, but it does not by itself produce a trustworthy pronunciation grade. It is deliberately out of scope for the hackathon MVP.

## Architecture

```text
Browser
  鈹溾攢 Web Speech Recognition (optional, fr-FR) 鈫?learner transcript
  鈹溾攢 localStorage 鈫?personal error/review map (local only)
  鈹斺攢 POST /api/analyze
         鈹?Node 18+ server
  鈹溾攢 no OPENAI_API_KEY 鈫?deterministic demo feedback
  鈹斺攢 OPENAI_API_KEY 鈫?OpenAI Responses API (GPT-5.6)
                            鈹?                       strict JSON Schema
                            鈹?                 structured teaching feedback in zh-CN + French
```

No database, framework, build step, or external dependency is required for the MVP. This is intentional: a judge can run it quickly, and a user can test the interaction without creating an account.

## Quick start

### Prerequisites

- Node.js 18 or later
- A current desktop browser. Chrome-based browsers normally offer the best support for browser speech recognition.

### Run in deterministic demo mode

```bash
npm start
```

Open [http://localhost:3000](http://localhost:3000). Click **鈥滆浇鍏ユ紨绀哄洖绛斺€?* and then **鈥滆幏寰楀弽棣堚€?* to see the complete flow without any account or API key.

### Enable GPT-5.6 live feedback

1. Copy `.env.example` to `.env`.
2. Set `OPENAI_API_KEY` to an API key authorised to use the specified model.
3. Keep `OPENAI_MODEL=gpt-5.6`, or set it to the permitted Build Week model identifier in your account if necessary.
4. Start the app with the environment variables loaded by your shell:

```bash
# macOS / Linux
OPENAI_API_KEY="your_key" OPENAI_MODEL="gpt-5.6" npm start

# PowerShell
$env:OPENAI_API_KEY="your_key"; $env:OPENAI_MODEL="gpt-5.6"; npm start
```

When live mode is active, the pill in the top-right reads **鈥淕PT-5.6 路 Live feedback.鈥?* The key remains on the server; it is never sent to the browser or stored in localStorage.

> `.env` is provided as a documentation template only. This dependency-free server does not load dotenv automatically; use your shell, a deployment platform's secret settings, or your preferred environment loader.

## Validation

```bash
# Starts the server
npm start

# In another terminal, checks the endpoint
curl http://localhost:3000/api/health
```

Expected output in a keyless local run:

```json
{"status":"ok","mode":"demo"}
```

Manual smoke test:

1. Open the app and select **鐪嬫埧涓庣鎴?*.
2. Click **杞藉叆婕旂ず鍥炵瓟**.
3. Click **鑾峰緱鍙嶉**.
4. Verify the natural rewrite, Mandarin-transfer explanation, 30-second drill, next turn, and local learner map appear.
5. Refresh the page: the learner map should persist in that browser only.

## API contract

`POST /api/analyze`

```json
{
  "scenarioId": "apartment",
  "transcript": "Bonjour, je veux louer une appartement. C'est disponible ?"
}
```

The server returns a stable structured object containing a level, a natural rewrite, up to three issues, non-acoustic pronunciation checkpoints, conversational scores, a next turn, and a micro-drill. In live mode, this structure is enforced with JSON Schema on the Responses API call; this makes the UI robust and keeps the model from returning unstructured prose.

## How Codex and GPT-5.6 were used

This repository was created in a Codex session during OpenAI Build Week.

- **Codex** accelerated the full product loop: framing the user problem, designing the zero-dependency architecture, implementing the responsive interface and API server, generating the schema and deterministic demo, writing documentation, and running local checks.
- **GPT-5.6**, via the OpenAI Responses API in live mode, functions as the teaching-reasoning layer. It receives the scenario, learner transcript, and constrained coaching rubric; it returns bilingual, structured, task-focused repairs rather than generic chat output.
- The product choices remained human-directed: France-specific immigrant contexts, Mandarin-transfer explanations, limited corrective load, and the decision not to overclaim transcript-only pronunciation assessment.

For Build Week submission, add the `/feedback` Session ID for the Codex conversation in which the core functionality was built to the Devpost form.

## Deployment notes

The app is a stateless Node server. Any Node 18+ host can run `npm start` after setting `OPENAI_API_KEY` and `OPENAI_MODEL` as server-side secrets. For a public demo, leave Demo Mode enabled until a reviewer intentionally supplies a key, or protect live API access with authentication/rate limits before opening it broadly.

## Safety and privacy

- The MVP stores only aggregate exercise focus counts in the current browser's localStorage.
- Do not submit medical histories or immigration documents. The pharmacy scenario is language practice, not medical advice.
- In live mode, the learner transcript is sent to the OpenAI API to generate feedback. A production deployment should add consent, retention controls, abuse protection, and a privacy notice appropriate to its jurisdiction.
- Do not infer a learner's accent or score a phoneme solely from a transcript.

## Repository contents

```text
public/index.html     Responsive user interface
public/app.js         Scenario flow, speech-recognition integration, local learner map
public/styles.css     Visual design and responsive layout
server.mjs            Static server, demo engine, and optional OpenAI API integration
PROJECT_DESCRIPTION.md English Devpost submission copy
DEMO_SCRIPT.md        <3 minute public-video narration plan
```

## License

MIT. See [LICENSE](LICENSE).


## Build Week highlight: Offline Speech Lab

Parler Chine now includes an **on-device Speech Lab** that makes speaking visible without outsourcing learner audio to a speech-scoring vendor.

When a learner taps the microphone, the browser's Web Audio APIs create three live visualisations from the microphone stream:

- **Waveform** ? the amplitude contour, useful for noticing whether the learner is audible and sustained.
- **Rolling spectrum (80?4,000 Hz)** ? a time-moving frequency-energy view, generated locally from the analyser's FFT values.
- **F0 contour** ? an autocorrelation estimate of fundamental frequency on voiced frames only, shown in the 75?360 Hz display range.

At the end of a take, the app reports local, non-diagnostic reflection metrics: capture duration, voiced-frame ratio, median F0, and pauses longer than roughly 300 ms after speech begins. The learner can replay their just-recorded take from browser memory.

### What this does **not** claim

The app does **not** turn pitch or a spectrogram into an accent score. It never says that a French vowel, /r/, liaison, or word was pronounced correctly solely from a transcript or one generic acoustic feature. F0 is highly speaker- and context-dependent. The lab is a transparent rehearsal aid for pacing, audibility, and self-comparison; phoneme-level scoring requires a separately validated audio alignment or assessment system.

### Audio privacy and offline boundary

All microphone capture, FFT analysis, autocorrelation, visualisation, and temporary replay are performed in the current browser tab using `getUserMedia`, `AnalyserNode`, `AudioContext`, canvas, and `MediaRecorder`. Raw audio is neither posted to `/api/analyze` nor written to localStorage. A new take replaces the prior replay blob, and closing or refreshing the tab removes it.

Browser speech recognition remains an optional convenience for transcript entry and is distinct from Speech Lab. Browser implementations may use their own services; users who need a strictly local interaction can type the French transcript while using the local audio lab only.

## Build Week highlight: Mission Evidence

Language correctness is not the same as completing a real-world task. The feedback now includes a **Mission Evidence** panel that makes the objective inspectable. In the apartment scenario, for example, it identifies whether the learner explicitly mentioned availability, rent, and charges/documents. It shows what was heard, what still needs to be said, and the smallest useful next move.

- In Demo Mode, the evidence engine is deterministic and visibly testable.
- In GPT-5.6 Live Mode, `taskEvidence` is part of the strict JSON Schema and the model prompt instructs it to use only information explicitly present in the learner's words.
- It is evidence of **communicative coverage**, never a claim that an administrative or medical outcome is guaranteed.
