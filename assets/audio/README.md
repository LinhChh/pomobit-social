# Audio beds for Reels

Reels rendered by `src/reel.js` mix in one music bed from this folder
(`bed.mp3` by default). Facebook's Graph API does not let us use Meta's own
music library, so the track has to ship in the repo.

## `bed.mp3` — synthesized placeholder (CC0)

Generated locally with ffmpeg (a slow four-note pad: A1/E2/A2/C#3, tremolo +
low-pass + a short echo). It is **not** production music — it exists so the
render pipeline and CI smoke test work end to end. Swap it for a real
royalty-free / CC0 track before publishing Reels at volume.

Regenerate it with:

```
node scripts/make-audio-bed.js
```

## Adding a real track

1. Drop a CC0 / royalty-free `.mp3` (≥ 16s, 44.1kHz) into this folder.
2. Record the source URL, author, and licence below.
3. Point a calendar entry at it with `"audio": "assets/audio/<file>.mp3"`, or
   replace `bed.mp3` to change the default for every Reel.

| File | Source | Author | Licence |
|------|--------|--------|---------|
| `bed.mp3` | synthesized (`scripts/make-audio-bed.js`) | — | CC0 |
| `lunarboommusic-guqin-melody-564700.mp3` | [pixabay.com/music/world-guqin-melody-564700](https://pixabay.com/music/world-guqin-melody-564700/) | LunarBoomMusic (AI-generated) | Pixabay Content License |
| `lunarboommusic-bejing-harmony-564703.mp3` | [pixabay.com/music/world-bejing-harmony-564703](https://pixabay.com/music/world-bejing-harmony-564703/) | LunarBoomMusic (AI-generated) | Pixabay Content License |
| `vitalsource-happy-china-545018.mp3` | [pixabay.com/music/world-happy-china-545018](https://pixabay.com/music/world-happy-china-545018/) | VitalSource (Sudzin Vitalii, BMI-registered) | Pixabay Content License |
