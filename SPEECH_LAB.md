# Offline Speech Lab

## Purpose

The Speech Lab is a privacy-preserving practice visualiser for Parler Chine. It gives an adult learner immediate evidence about their speech flow while they rehearse a France-based real-life task.

It deliberately answers limited questions:

- Did the microphone receive a usable signal?
- Did the learner speak continuously enough to rehearse a full turn?
- Where were the longer pauses?
- What does the learner's own loudness, spectrum and F0 movement look like over the take?

It does not infer identity, accent, proficiency, or phoneme correctness.

## On-device pipeline

```text
Microphone permission
  -> MediaStream
  -> AudioContext + AnalyserNode (FFT 2048)
       -> Float time-domain frames -> RMS and autocorrelation F0
       -> Byte frequency frames -> rolling 80?4,000 Hz spectrum
  -> Canvas -> waveform, spectrum, pitch trace
  -> In-memory MediaRecorder blob -> optional take replay
```

The raw `MediaStream` and `MediaRecorder` blob remain in the tab. The app sends only the learner's text transcript to `/api/analyze` for language feedback. It does not persist audio in localStorage, IndexedDB, or the Node server.

## Metric definitions

| Metric | Local calculation | Appropriate interpretation |
| --- | --- | --- |
| Duration | First-to-last analysis frame | Whether the learner produced enough material to rehearse a turn. |
| Voiced frames | Fraction of frames with stable autocorrelation F0 | A rough signal/continuity cue, not a voice-quality score. |
| Median F0 | Median of detected F0 values, searching 75?360 Hz | A personal observation point only; do not compare across learners. |
| Pauses | Silent runs of approximately 18 frames after initial voice | Where the learner may have been searching for language or breathing. |
| Waveform | Time-domain amplitude | Audibility and phrase continuity. |
| Spectrum | FFT energy plotted from 80?4,000 Hz | Visual self-reflection; it is not formant assessment. |

## Pitch algorithm

Each frame is mean-centred. The lab scans lags corresponding to 75?360 Hz and selects the largest normalised autocorrelation coefficient. Values below 0.58 are treated as unvoiced. This keeps the implementation small, transparent, dependency-free, and fully local. It is suitable for a hackathon practice visualiser, not clinical, forensic, or assessment use.

## Honest limits

A pitch trace cannot verify a French /y/, /R/, liaison, stress pattern, or comprehensibility. A production phoneme-feedback feature would need consented audio, a validated reference target, language-appropriate forced alignment or a dedicated speech-assessment model, calibration across microphones, and a learner-facing uncertainty policy. Those are deliberately out of scope here.

## Browser support

The lab needs a modern browser with `getUserMedia`, Web Audio, canvas, and preferably `MediaRecorder`. `localhost` is normally treated as a secure context for microphone access. Browser speech recognition is optional; direct text input preserves the full coaching flow where it is unavailable.
