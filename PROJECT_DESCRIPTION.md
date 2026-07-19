# Parler Chine 鈥?Devpost Project Description

## Tagline

**A real-life French speaking coach that turns Mandarin learners' recurring mistakes into short, situation-based repairs for life in France.**

## Inspiration

Moving to France creates a particular kind of language pressure. A Chinese learner may know the grammar exercise but still freeze while viewing an apartment, asking a pharmacist for help, or preparing a residence-permit appointment. The consequence is not only an incorrect sentence; it can be a missed home, an unclear health conversation, or an abandoned administrative task.

Most AI language tools are either broad chatbots or correction engines. They do not begin with the learner's actual task, and they often overwhelm a speaker with every possible mistake. We wanted to build something more humane: a coach that helps a learner get through the next real interaction, then makes just one repair memorable.

## What it does

Parler Chine is a web-based French speaking coach for Mandarin speakers living in France. A learner chooses a real situation 鈥?apartment visit, pharmacy, or pr茅fecture appointment 鈥?speaks or types a reply, and receives a focused coaching turn.

The experience includes:

- A practical objective, a small vocabulary safety rail, and a realistic conversational continuation.
- An intent-preserving natural French rewrite.
- At most three high-impact corrections, each explained in Simplified Chinese.
- A 鈥渨hy this happens鈥?tip tied to Mandarin-to-French transfer, such as grammatical gender, literal translation, or `tu`/`vous` register.
- An honest pronunciation checkpoint with listening/repetition practice, rather than a false transcript-only phoneme score.
- A 30-second micro-drill that turns the most useful repair into speech.
- A local learner map that remembers which expression patterns deserve revisiting.

## How we built it

The MVP is a dependency-free Node 18+ application with a responsive browser interface. It uses browser speech recognition in `fr-FR` when available and always supports direct transcript input.

With an OpenAI API key, the Node server uses the OpenAI **Responses API** with **GPT-5.6** and a strict JSON Schema. The schema makes the model return exactly the fields the learning interface needs: a natural rewrite, limited corrections, Mandarin-specific teaching tips, a non-acoustic pronunciation checkpoint, a next turn, and a micro-drill. The prompt explicitly prevents false acoustic claims based on text alone and constrains the model to preserve the learner's intent.

For a frictionless, testable demo, the same interface works without an API key in deterministic Demo Mode. Judges can load a built-in sample answer and see the complete feedback loop immediately. Live feedback is visibly labelled when a key is configured.

## How Codex accelerated our work

Codex helped us move from a fuzzy education idea to a runnable product in one building session: it structured the teaching rubric, designed the user journey, implemented the server and responsive interface, integrated the optional Responses API layer, created the deterministic test path, and produced the README, demo script, and testing instructions.

GPT-5.6 is used for the part that benefits from nuanced language reasoning: interpreting a learner's intended meaning in a situation, choosing only the highest-impact repairs, explaining why a Mandarin speaker may make them, and generating an appropriate next conversational turn. We deliberately kept human product judgement in the loop 鈥?especially in selecting France-specific immigrant contexts and refusing to label transcript-only feedback as precise pronunciation scoring.

## Challenges we ran into

The hardest design question was pronunciation. A transcript can hint at an issue, but it cannot truthfully prove how a learner formed a vowel or an /r/. We rejected the tempting 鈥渟pectrogram equals score鈥?approach. In this MVP, pronunciation feedback is clearly framed as a listening/repetition checkpoint. A future version can add consented audio capture and a validated forced-alignment or phoneme-assessment pipeline before offering acoustic scoring.

We also had to resist building a generic French tutor. Narrowing the product to three high-stakes daily situations made both the interface and the evaluation more meaningful.

## Accomplishments we are proud of

- A complete conversation loop that can be demoed without credentials or setup beyond Node.
- A correction experience that is supportive, bounded, and designed around task completion.
- Mandarin-transfer explanations that make errors teachable rather than merely marked wrong.
- A clear, technically honest boundary around what transcript-derived pronunciation feedback can and cannot claim.

## What we learned

For education AI, the best feedback is not necessarily the most feedback. It needs a goal, a rationale the learner recognises, and a chance to try again quickly. Structured output was particularly useful: it turned a powerful language model into a predictable learning interaction instead of a long, inconsistent chat response.

## What鈥檚 next

- Add more lived-France scenarios: school meetings, bank appointments, workplace small talk, and emergency navigation.
- Introduce consented audio recording and validated word timing/forced alignment for deeper pronunciation practice.
- Add teacher and cohort views that show anonymised Mandarin-transfer patterns.
- Evaluate improvement over multiple sessions with pre/post scenario tasks, not just single-turn accuracy.

## Track

**Education**

## Test instructions

1. Run `npm start` with Node 18+.
2. Open `http://localhost:3000`.
3. Click **杞藉叆婕旂ず鍥炵瓟**, then **鑾峰緱鍙嶉**.
4. No OpenAI account or API key is needed for Demo Mode.
5. For GPT-5.6 live feedback, configure `OPENAI_API_KEY` as described in the README.


## New Build Week highlight: Offline Speech Lab + Mission Evidence

We added a second feedback layer that is deliberately independent of commercial speech-analysis APIs. The browser's local Web Audio pipeline reads the microphone stream, derives a live waveform, a rolling 80?4,000 Hz spectrum, an autocorrelation-based F0 contour, capture duration, voiced-frame ratio, median F0, and pauses. Learners can replay their take from temporary tab memory. No raw audio is sent to our server, the OpenAI API, or localStorage.

This is not presented as an accent score. Acoustic values are useful for noticing flow, audibility, and pause patterns, but a generic pitch contour cannot establish whether someone produced a French phoneme correctly. The UI explains that boundary directly.

We also added **Mission Evidence**: instead of treating grammar correctness as success, the app exposes which pieces of practical information were explicitly communicated and which one should be added next. This turns the feedback loop into an observable, scenario-specific measure of communicative coverage.
