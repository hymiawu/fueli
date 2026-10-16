# Scan eval photos

The `scan` suite in `eval/run.js` checks the ingredient scanner against labeled photos. It runs only when `cases.json` lists at least one photo.

## Adding photos
- Use your own photos of a single food item each: no faces, receipts, addresses or screens. 8–10 photos is enough to start.
- JPEG, PNG or WebP, under 6 MB. The runner strips EXIF data before upload, but crop anything personal anyway.
- Include 1–2 photos that are **not** food (for example a mug or a laptop) to test `isFood: false`.

Put the files in this folder and describe each one in `cases.json`:

```json
[
  { "id": "S1-banana", "file": "banana.jpg", "isFood": true, "names": ["banana"], "inDatabase": true },
  { "id": "S2-mug", "file": "mug.jpg", "isFood": false }
]
```

- `names`: acceptable answers; the case passes if the scanned name contains any of them.
- `inDatabase`: set to `true` when the food is in `server/src/data/nutrition.json`, so the check also requires database nutrition values.

## Running
```bash
cd server && npm run eval -- --only scan
```
