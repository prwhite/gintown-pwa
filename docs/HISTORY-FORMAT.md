# History format and OCR pipeline

> The PWA has a single canonical JSON shape used by both backup and import,
> and by the offline OCR conversion script. This doc covers the shape,
> the OCR conversion, and the dedup-on-import behaviour.

## The durable shape

```json
{
  "format": "gintown-history",
  "version": 1,
  "exportedAt": "2026-05-13T08:55:00.000Z",
  "games": [
    /* IDB Game records, verbatim */
  ]
}
```

Each entry in `games` is exactly the IDB `Game` shape from
`src/lib/db.ts`. A round-trip (import → IDB → export) is identity-stable.

Defined in `src/lib/history-format.ts`:

- `FORMAT_ID` — string constant `"gintown-history"`.
- `FORMAT_VERSION` — number constant `1`.
- `parseHistoryBundle(text): { bundle, error }` — JSON parse + structural
  validation. Per-game validation is lenient: a malformed entry is
  dropped (with no fatal error) rather than failing the whole import.
- `buildExportBundle(games): string` — pure function, no IDB read.
- `defaultBackupFilename()` — `gintown-YYYYMMDD-HHMM.json`.
- `countHands(games)` — convenience for status messages.

## Save / import / clear flow

All triggered from `HistoryModal.svelte`, which the History button on the
main page opens.

- **Save backup.** `listGames()` → `buildExportBundle()` → `Blob` →
  programmatic `<a download="…">.click()`. On iOS-installed PWA, this
  opens the OS Save sheet (iCloud Drive integration).
- **Import.** Hidden `<input type="file">`. After parse, the modal
  previews "Found N games" with an Import button. On confirm,
  `getAllGameIds()` gives the existing set; games whose id is already
  in IDB are **skipped silently**, the rest go through `bulkPutGames()`
  in a single IDB transaction.
- **Clear.** Confirmation modal → `clearAllGames()` + `currentGame.clear()`.

Important: parsed games live in a **plain `let pendingGames`**, not in
`$state`. If they were in `$state`, the Svelte 5 deep Proxy would make
IDB's `structuredClone` algorithm reject them. See the footgun list in
`CLAUDE.md`.

## Stable UUIDs (so dedup works)

The PWA's import path dedups by `id`. For the dedup to be useful across
imports of the same source, ids must be **deterministic from content**,
not freshly random.

- `crypto.randomUUID()` (used by `newGameId()` in `src/lib/db.ts`) is
  fine for games created live in the app — once written, the id never
  changes.
- The OCR seed converter uses a **SHA-256-derived UUID** over a content
  fingerprint:

  ```
  fingerprint = JSON.stringify({
    game_id,                            // from the OCR JSON
    hands: [[hand_number, k_score, r_score, hand_winner, dealer], ...]
  });
  id = uuidFromHash("gintown-ocr|" + fingerprint);
  ```

  Same input → same UUID across runs. Re-running the converter and
  re-importing the same data is a no-op. Editing source OCR data
  changes the fingerprint and produces a new id, which means the
  edited version will import alongside (not replace) the old one —
  acceptable since OCR edits should be rare and the user can
  swipe-delete the stale row.

## Offline OCR conversion script

`scripts/convert-ocr-history.mjs`. Plain Node, zero deps. Run via
`make seed-history` or `node scripts/convert-ocr-history.mjs`.

Reads every `*.json` from `history.nogit/` (the user's local-only
folder of OCR'd RTF scoresheets). Writes the durable bundle to
`history.nogit/gintown-history-seed.json`.

### Player mapping (hard-coded)

| Source | Mapped to | Index |
|---|---|---|
| `K` | `"Kirsty"` | 0 |
| `R` | `"Rusty"` | 1 |

No prompt, no config. If a new player ever enters the picture, this
script has to be modified, or the user enters games live in the app
(which has free-text name input).

### Date synthesis

Source OCR JSONs have no usable date. The script spreads games
chronologically by `game_id` in **1-hour increments ending one day
before the script runs**. Order is preserved, everything lands clearly
in the past. Per-hand `createdAt` is `gameCreatedAt + i * 30_000`.

### Krusty-specific quirks the converter handles

- `hand_winner === "TIE"` — resolves to the player with the higher hand
  score; if equal, picks Kirsty (per house rule). Logs a warning.
- `hand_winner === "K"` or `"R"` — straightforward mapping.
- Anything else — picks the higher scorer and logs a warning.
- Empty `hands: []` — skipped with a warning.
- `firstDealerIndex` — inferred from the first hand whose `dealer`
  field is set, then **reverse-alternated** to hand 1. If no dealer
  info at all, defaults to 0 (Kirsty).
- `defenderDeadwood` / `defenderLayoffs` are forced to `0` for OCR'd
  games — the source doesn't have this data; the stats view will show
  "0 / 0" for those metrics, which is accurate-as-zero-data.

### Source fields the converter ignores

`source_file`, `num_hands`, `k_final_score`, `r_final_score`, `margin`,
`reconciled`, `format_era`, `flags`, `k_running_total`, `r_running_total`,
`date` (always null in the corpus). They're either derivable, redundant,
or noise.

### Script output

Stdout report ends with:

```
Wrote 52 games (203 hands). 3 warnings.
```

The user runs the script when source data changes, then imports the
resulting seed via the PWA's History modal. The seed file is gitignored
along with the rest of `history.nogit/`.

## Editing the format (future)

If you have to evolve the durable shape:

1. **Don't change the meaning of `version: 1`.** Add `version: 2`.
2. Make `parseHistoryBundle` tolerate both versions, normalizing v1 to
   v2 on the way in.
3. The exporter always emits the latest version. Old backups still
   import; new backups don't have to be readable by old builds.
4. If a field is added to `Game`, also bump the IDB schema version and
   write a migration (see `docs/ARCHITECTURE.md`). The two version
   numbers are independent on purpose — durable JSON evolves separately
   from IDB.
