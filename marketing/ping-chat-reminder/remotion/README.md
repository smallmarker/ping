# Ping product promo · motion revision V2

30 seconds · 1080×1920 · 30fps · original music + UI SFX · no voiceover.

## Workflow ownership

The main production skill for V2 is **remotion-marketing-video**, installed for this Codex user at `/Users/fiture-zl/.codex/skills/remotion-marketing-video`. Source commit and validation record: `.marketing/skill-install.json`.

The existing marketing brief and video script remain factual and narrative inputs. The original remotion-video skill is retained and does not direct this revision.

## Preview

```sh
npm run studio -- --no-open --port 3000 --webpack-poll 1000
```

Open http://localhost:3000/Main. `Main` is V2. `PreviousDraft` retains V1 for comparison. The complete original source/package files are backed up in `history/v1-before-motion/`.

## What changed

A single device container persists across the product workflow. Camera positions, UI-space tap locations, screenshot changes and audio triggers share the frame event table. Headline lines enter and exit in layers; real screens crossfade at the interaction result. The camera pushes toward clipboard preview, glides to the input and Ping icon, focuses the confirmation summary, then tracks down to the confirmation button. No decorative flash/wipe transitions were added.

- `src/promo/theme.ts`: design tokens and motion curves.
- `src/promo/sceneGraph.ts`: scene goals, computed starts, 900-frame total, interaction and sound maps.
- `src/promo/motion.ts`: continuous camera path and coordinate conversion.
- `src/promo/Device.tsx`: persistent device, real screenshot layers, focus and tap overlays.
- `src/promo/Typography.tsx`: staggered headlines and captions.
- `src/promo/Composition.tsx`: main sequence, audio and closing choreography.
- `tools/generate-audio.py`: original deterministic music and UI tone synthesis.

## Planning inputs

- `../../../docs/marketing/brief-ping-chat-reminder.md`
- `../../../scripts/ping-chat-reminder.md` (original approved story)
- `../../../scripts/ping-chat-reminder-motion-v2.md` (motion revision)
- `../motion-revision-plan.md` (code review and improvement plan)

## Product truth and assets

`public/home.png`, `clipboard.png`, `filled.png`, `confirm.png`, and `authorization.png` are unchanged real WeChat DevTools captures from V1. The last file captures the “saving” state; it is never presented as proof of notification authorization. Camera framing avoids transient system toast obstructions without editing screenshot content.

Chat and notification screens are explicitly labelled demonstrations. The coffee text and Saturday 15:00 match both the real parser and real cloud parse. Delivery needs user authorization and the service to send successfully. No claims of automatic chat reading, automatic paste, large-model AI, repeat reminders, or guaranteed delivery are made.

V2 does not modify the mini program, cloud configuration, existing Skills or reminder data. V1 previously created one demonstration reminder for 2026-10-17 15:00 +08:00 with notification permission denied.

## Audio

No stock music or third-party sound recording was downloaded. All media is kept in the project `public/audio/`; provenance and generation details are included there. The original music uses 96 BPM, with a quiet bed and short interaction sounds. It does not imitate WeChat's official notification sound.

## Checks and approval

`npm run typecheck` must pass. `node qa-motion.cjs` checks representative still frames. `node qa-motion.cjs --affected --draft` checks only the updated focus frames and a 5.5–13.0s low-resolution draft, including stereo audio. Still/range drafts are QA assets, not final exports.

Final output is proposed at `../video.mp4`, 1080×1920 H.264, 30fps, yuv420p, AAC stereo. Complete final render remains pending the user's approval of the V2 preview and output path.

The inherited CLI template uses scale 2, which produces a 2160×3840 intermediate; downsample that intermediate to exactly 1080×1920 with Lanczos, or explicitly override scale to 1. Do not deliver the scale-2 intermediate as the requested 1080×1920 MP4.
