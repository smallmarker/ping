# Audio provenance

The soundtrack and interface tones were synthesized locally for the Ping promo with tools/generate-audio.py (deterministic seed 16102026). No third-party melody, stock recording, platform notification sound, or commercial music sample was used.

music-original.wav is the original 96 BPM stereo instrumental. music-bed.wav is its FFmpeg loudness-normalized version (target -24 LUFS, true-peak ceiling -3 dBTP, 48 kHz). The composition adds its own entry/exit envelope and uses 0.8 volume.

All tap/copy/message/ping/move files are original short synthesized tones. Their exact timeline triggers and gains are in src/promo/sceneGraph.ts. No speech or voice imitation is included.
