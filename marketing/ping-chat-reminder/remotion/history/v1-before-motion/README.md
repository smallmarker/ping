# Ping chat-to-reminder promo

30 seconds, 1080×1920, 30fps, silent with Chinese on-screen captions.

## Preview

```sh
npm run studio -- --no-open --port 3000
```

Open http://localhost:3000/Main. Six standalone scene compositions are registered under Scenes. Preview approval is still required before final MP4 export.

## Source of truth

- `../../../docs/marketing/brief-ping-chat-reminder.md`
- `../../../scripts/ping-chat-reminder.md`
- `src/story.ts`: 90+150+180+210+120+150 = 900 frames.
- `.marketing/brand.json`: colors, font and logo scanned from the product repository.

## Real product assets

`public/home.png`, `clipboard.png`, `filled.png`, `confirm.png` are actual screenshots captured via Tencent's miniprogram-automator SDK from the running WeChat DevTools project. The clipboard scene crops and enlarges the original screenshot for legibility. No UI was recreated for these Ping pages.

`public/authorization.png` captured a saving state, not an authorization-success state. `public/saved.png` confirms that a demonstration record was created, with notifications not enabled in the simulator. These two assets are retained as evidence and are not displayed as successful authorization in the composition.

Chat is a fictional demonstration conversation, no message was sent to another person. Notification is an explicitly labelled demonstration based on the real supported title/time fields, not a captured delivery. A demonstration reminder titled “一起去喝咖啡”, dated 2026-10-17 15:00 +08:00, was saved in ping-dev during capture; its notification permission is denied. No platform configuration or cloud code was changed.

## Verification completed

- Real parser and real cloud parse both returned “一起去喝咖啡”, 2026-10-17 15:00 +08:00.
- `npm run typecheck` passed.
- QA stills generated for frames 55, 210, 290, 360, 510, 600, 690, 840, checked for text and screenshots.
- Browser Studio reloaded to verify the final layout after HMR had left one old layout visible.
- No final MP4 has been rendered yet.

## Final export after approval

The template's scale=2 produces a 2160×3840 intermediate, not 1080×1920. Export the intermediate with PNG frames, H.264, CRF 14 and yuv420p, then resize to the user's exact requested output with ffmpeg:

```sh
npx remotion render src/index.ts Main out/master-2x.mp4 --codec h264 --crf 14 --image-format png --pixel-format yuv420p --scale 2
ffmpeg -i out/master-2x.mp4 -vf scale=1080:1920:flags=lanczos -c:v libx264 -crf 14 -preset slow -pix_fmt yuv420p -movflags +faststart ../video.mp4
npx remotion still src/index.ts Main ../poster.jpg --frame 55 --image-format jpeg --scale 1 --jpeg-quality 95
```

Verify final dimensions, duration, frame rate and pixel format with ffprobe. The poster JPEG is a still deliverable; final video intermediates must remain PNG.
