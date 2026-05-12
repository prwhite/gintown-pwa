<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { pwaInfo } from 'virtual:pwa-info';
  import { useRegisterSW } from 'virtual:pwa-register/svelte';

  let { children } = $props();

  let needRefresh = $state(false);
  let updateSW: ((reload?: boolean) => Promise<void>) | undefined;

  onMount(async () => {
    // Request persistent storage so the browser is less likely to evict our IDB.
    if (navigator.storage?.persist) {
      try {
        const persisted = await navigator.storage.persisted();
        if (!persisted) {
          const granted = await navigator.storage.persist();
          if (!granted) {
            console.warn('[storage] persistent storage not granted; history may be evicted under storage pressure');
          }
        }
      } catch (e) {
        console.warn('[storage] persist() failed', e);
      }
    }

    // Register the service worker (with manual update prompt so an in-progress game isn't yanked).
    const reg = useRegisterSW({
      onNeedRefresh() {
        needRefresh = true;
      },
      onOfflineReady() {
        console.log('[pwa] offline ready');
      }
    });
    updateSW = reg.updateServiceWorker;
  });

  function applyUpdate() {
    needRefresh = false;
    updateSW?.(true);
  }
</script>

<svelte:head>
  {@html pwaInfo ? pwaInfo.webManifest.linkTag : ''}
</svelte:head>

<main class="shell">
  {@render children()}
</main>

{#if needRefresh}
  <div class="update-toast" role="alert">
    <span>New version available</span>
    <button class="btn-primary" onclick={applyUpdate}>Reload</button>
  </div>
{/if}

<style>
  /* Padding respects iOS safe-area-insets so content (and esp. the back button
     + main-page card fan) clears the status bar / notch and home indicator on
     PWA installs. apple-mobile-web-app-status-bar-style is black-translucent
     and viewport-fit=cover (see app.html), so env() gives the actual inset. */
  .shell {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    max-width: 640px;
    margin: 0 auto;
    padding-top: max(16px, calc(env(safe-area-inset-top) + 8px));
    padding-right: max(16px, env(safe-area-inset-right));
    padding-bottom: max(16px, calc(env(safe-area-inset-bottom) + 8px));
    padding-left: max(16px, env(safe-area-inset-left));
  }

  .update-toast {
    position: fixed;
    left: 50%;
    bottom: max(16px, calc(env(safe-area-inset-bottom) + 16px));
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    background: var(--bg-dark);
    border: 1px solid rgba(255, 255, 255, 0.15);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
    z-index: 200;
  }

  .update-toast button {
    padding: 8px 16px;
    font-size: 14px;
  }
</style>
