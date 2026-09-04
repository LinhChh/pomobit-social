# Audio beds for Reels

Reels rendered by `src/reel.js` mix in one music bed from this folder
(`lunarboommusic-guqin-melody-564700.mp3` by default — see `DEFAULT_AUDIO` in
`src/reel.js`). Facebook's Graph API does not let us use Meta's own music
library, so the track has to ship in the repo.

## Adding a real track

1. Drop a CC0 / royalty-free `.mp3` (≥ 16s, 44.1kHz) into this folder.
2. Record the source URL, author, and licence below.
3. Point a calendar entry at it with `"audio": "assets/audio/<file>.mp3"`, or
   change `DEFAULT_AUDIO` in `src/reel.js` to change the default for every Reel.

| File | Source | Author | Licence |
|------|--------|--------|---------|
| `lunarboommusic-guqin-melody-564700.mp3` (default) | [pixabay.com/music/world-guqin-melody-564700](https://pixabay.com/music/world-guqin-melody-564700/) | LunarBoomMusic (AI-generated) | Pixabay Content License |
| `lunarboommusic-bejing-harmony-564703.mp3` | [pixabay.com/music/world-bejing-harmony-564703](https://pixabay.com/music/world-bejing-harmony-564703/) | LunarBoomMusic (AI-generated) | Pixabay Content License |
| `vitalsource-happy-china-545018.mp3` | [pixabay.com/music/world-happy-china-545018](https://pixabay.com/music/world-happy-china-545018/) | VitalSource (Sudzin Vitalii, BMI-registered) | Pixabay Content License |
