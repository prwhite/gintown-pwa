<script lang="ts">
  /**
   * Load / save / clear modal triggered from the main-page HistoryButton.
   *
   *   Save backup    → builds a JSON bundle from current IDB, downloads it
   *                    as gintown-YYYYMMDD-HHMM.json. On iOS the OS Save sheet
   *                    appears, user picks iCloud Drive.
   *   Import history → file picker, parses one JSON bundle, bulk-inserts
   *                    games into IDB. Skips games whose `id` already exists
   *                    (the converter and crypto.randomUUID produce stable
   *                    ids, so re-importing the same bundle dedups cleanly).
   *   Clear history  → wipes every game from IDB after a confirmation prompt.
   *                    Also clears the currentGame localStorage pointer.
   */
  import {
    bulkPutGames,
    clearAllGames,
    getAllGameIds,
    listGames,
    type Game
  } from '$lib/db';
  import { currentGame } from '$lib/stores/currentGame';
  import { history } from '$lib/stores/history';
  import {
    buildExportBundle,
    countHands,
    defaultBackupFilename,
    parseHistoryBundle
  } from '$lib/history-format';

  interface Props {
    onClose: () => void;
  }
  let { onClose }: Props = $props();

  type Status =
    | { kind: 'idle' }
    | { kind: 'previewing'; gameCount: number; handCount: number }
    | { kind: 'importing' }
    | { kind: 'imported'; gameCount: number; handCount: number; skipped: number }
    | { kind: 'confirmingClear'; count: number }
    | { kind: 'clearing' }
    | { kind: 'cleared'; count: number }
    | { kind: 'error'; message: string };

  let status = $state<Status>({ kind: 'idle' });
  let fileInput: HTMLInputElement | undefined = $state();
  let saving = $state(false);

  // The pending parsed games live OUTSIDE $state on purpose. If they were in
  // $state, Svelte 5 would wrap each Game in a Proxy, and IDB's structured-
  // clone algorithm refuses Proxies with "The object can not be cloned".
  let pendingGames: Game[] = [];

  async function onSave() {
    if (saving) return;
    saving = true;
    try {
      const games = await listGames();
      const text = buildExportBundle(games);
      const blob = new Blob([text], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = defaultBackupFilename();
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      status = { kind: 'error', message: `Couldn't build backup: ${(e as Error).message}` };
    } finally {
      saving = false;
    }
  }

  function pickFile() {
    fileInput?.click();
  }

  async function onFileChange(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const { bundle, error } = parseHistoryBundle(text);
      if (error || !bundle) {
        status = { kind: 'error', message: error ?? 'Could not parse file.' };
      } else if (bundle.games.length === 0) {
        status = { kind: 'error', message: 'File has 0 valid games — nothing to import.' };
      } else {
        pendingGames = bundle.games;
        status = {
          kind: 'previewing',
          gameCount: bundle.games.length,
          handCount: countHands(bundle.games)
        };
      }
    } catch (err) {
      status = { kind: 'error', message: `Could not read file: ${(err as Error).message}` };
    } finally {
      // Reset so picking the same file again still fires `change`.
      input.value = '';
    }
  }

  async function doImport() {
    if (status.kind !== 'previewing') return;
    const games = pendingGames;
    status = { kind: 'importing' };
    try {
      // Skip games whose id already lives in IDB.
      const existing = await getAllGameIds();
      const fresh = games.filter((g) => !existing.has(g.id));
      const skipped = games.length - fresh.length;
      const handCount = countHands(fresh);
      await bulkPutGames(fresh);
      await history.refresh();
      pendingGames = [];
      status = { kind: 'imported', gameCount: fresh.length, handCount, skipped };
    } catch (e) {
      status = { kind: 'error', message: `Import failed: ${(e as Error).message}` };
    }
  }

  async function askClear() {
    try {
      const games = await listGames();
      status = { kind: 'confirmingClear', count: games.length };
    } catch (e) {
      status = { kind: 'error', message: `Couldn't count games: ${(e as Error).message}` };
    }
  }

  async function doClear() {
    if (status.kind !== 'confirmingClear') return;
    const count = status.count;
    status = { kind: 'clearing' };
    try {
      await clearAllGames();
      await currentGame.clear();
      await history.refresh();
      status = { kind: 'cleared', count };
    } catch (e) {
      status = { kind: 'error', message: `Clear failed: ${(e as Error).message}` };
    }
  }

  function resetToIdle() {
    pendingGames = [];
    status = { kind: 'idle' };
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="modal-overlay"
  onclick={(e) => {
    if (e.target === e.currentTarget) onClose();
  }}
>
  <div class="modal" role="dialog" aria-modal="true" aria-labelledby="history-title">
    <h2 id="history-title">History</h2>

    <div class="actions">
      <button
        type="button"
        class="btn-secondary action"
        onclick={onSave}
        disabled={saving}
      >
        <svg viewBox="0 0 24 24" aria-hidden="true" class="action-icon">
          <path
            d="M 12 4 L 12 15 M 8 8 L 12 4 L 16 8 M 6 13 L 6 19 Q 6 20 7 20 L 17 20 Q 18 20 18 19 L 18 13"
            stroke="currentColor"
            stroke-width="1.6"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>{saving ? 'Saving…' : 'Save backup'}</span>
      </button>

      <button type="button" class="btn-secondary action" onclick={pickFile}>
        <svg viewBox="0 0 24 24" aria-hidden="true" class="action-icon">
          <path
            d="M 12 4 L 12 15 M 8 11 L 12 15 L 16 11 M 6 13 L 6 19 Q 6 20 7 20 L 17 20 Q 18 20 18 19 L 18 13"
            stroke="currentColor"
            stroke-width="1.6"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>Import history…</span>
      </button>
      <input
        type="file"
        accept=".json,application/json"
        bind:this={fileInput}
        onchange={onFileChange}
        hidden
      />

      <button type="button" class="action clear-btn" onclick={askClear}>
        <svg viewBox="0 0 24 24" aria-hidden="true" class="action-icon">
          <!-- trash icon -->
          <path
            d="M 6 8 L 18 8 M 9 8 L 9 5 Q 9 4 10 4 L 14 4 Q 15 4 15 5 L 15 8 M 7 8 L 8 20 Q 8 21 9 21 L 15 21 Q 16 21 16 20 L 17 8 M 10 11 L 10 18 M 14 11 L 14 18"
            stroke="currentColor"
            stroke-width="1.6"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
        <span>Clear history…</span>
      </button>
    </div>

    <!-- status area -->
    {#if status.kind === 'previewing'}
      <div class="status preview">
        <p>Found <strong>{status.gameCount}</strong> games ({status.handCount} hands).</p>
        <p class="dim">Games whose id already exists will be skipped.</p>
        <div class="status-actions">
          <button type="button" class="btn-secondary" onclick={resetToIdle}>Cancel</button>
          <button type="button" class="btn-primary" onclick={doImport}>Import</button>
        </div>
      </div>
    {:else if status.kind === 'importing'}
      <p class="status dim">Importing…</p>
    {:else if status.kind === 'imported'}
      <div class="status ok">
        <p>
          Imported <strong>{status.gameCount}</strong> games ({status.handCount} hands).
        </p>
        {#if status.skipped > 0}
          <p class="dim">Skipped {status.skipped} duplicate{status.skipped === 1 ? '' : 's'} already in history.</p>
        {/if}
      </div>
    {:else if status.kind === 'confirmingClear'}
      <div class="status warn">
        <p>
          Delete <strong>all {status.count}</strong> games? This can't be undone.
        </p>
        <div class="status-actions">
          <button type="button" class="btn-secondary" onclick={resetToIdle}>Cancel</button>
          <button type="button" class="btn-danger" onclick={doClear}>Yes, clear everything</button>
        </div>
      </div>
    {:else if status.kind === 'clearing'}
      <p class="status dim">Clearing…</p>
    {:else if status.kind === 'cleared'}
      <div class="status ok">
        <p>Cleared <strong>{status.count}</strong> game{status.count === 1 ? '' : 's'}.</p>
      </div>
    {:else if status.kind === 'error'}
      <div class="status err">
        <p>{status.message}</p>
        <button type="button" class="btn-secondary" onclick={resetToIdle}>Dismiss</button>
      </div>
    {/if}

    <div class="close-row">
      <button type="button" class="btn-ghost" onclick={onClose}>Close</button>
    </div>
  </div>
</div>

<style>
  h2 {
    font-size: 18px;
    font-weight: 700;
    margin-bottom: 16px;
  }

  .actions {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-bottom: 12px;
  }

  .action {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 12px 16px;
    font-size: 14px;
    font-weight: 600;
  }

  .action-icon {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  /* Clear button styled as a subtle danger affordance — readable as
     destructive without screaming for attention. */
  .clear-btn {
    background: rgba(239, 68, 68, 0.08);
    color: #f59797;
    border: 1px solid rgba(239, 68, 68, 0.25);
    border-radius: var(--radius-sm);
    cursor: pointer;
  }
  .clear-btn:hover {
    background: rgba(239, 68, 68, 0.16);
  }

  .status {
    margin-top: 8px;
    padding: 12px;
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.08);
    font-size: 13px;
  }

  .status p {
    margin: 0 0 6px;
  }
  .status p:last-child {
    margin-bottom: 0;
  }

  .status.err {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.08);
    color: #f59797;
  }

  .status.warn {
    border-color: rgba(239, 68, 68, 0.4);
    background: rgba(239, 68, 68, 0.08);
  }

  .status.ok strong {
    color: var(--success);
  }

  .status-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 10px;
  }
  .status-actions button {
    padding: 8px 14px;
    font-size: 13px;
    font-weight: 600;
  }

  .btn-danger {
    background: rgba(239, 68, 68, 0.18);
    color: var(--danger);
    border: 1px solid rgba(239, 68, 68, 0.4);
    border-radius: var(--radius-sm);
  }
  .btn-danger:hover {
    background: rgba(239, 68, 68, 0.28);
  }

  .dim {
    color: var(--text-muted);
  }

  .close-row {
    display: flex;
    justify-content: flex-end;
    margin-top: 14px;
    padding-top: 10px;
    border-top: 1px solid rgba(255, 255, 255, 0.06);
  }
  .close-row button {
    padding: 8px 14px;
    font-size: 13px;
  }
</style>
