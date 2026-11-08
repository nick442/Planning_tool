import { registerSW } from 'virtual:pwa-register';
import { showToast } from '@/components/toast';

const HOUR = 60 * 60 * 1000;

/**
 * Registers the service worker that makes the app installable and lets it
 * open offline. A new version is never swapped in under the user's hands:
 * a toast offers to reload instead.
 */
export function registerServiceWorker(): void {
  if (!('serviceWorker' in navigator)) return;

  const updateSW = registerSW({
    onNeedRefresh() {
      showToast({
        message: 'A new version is ready.',
        action: { label: 'Reload', run: () => void updateSW(true) },
        duration: null,
      });
    },
    onOfflineReady() {
      showToast({ message: 'Ready to work offline.', duration: 3000 });
    },
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      // Look for updates now and then, and whenever the app comes back to the front.
      setInterval(() => void registration.update(), HOUR);
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') void registration.update();
      });
    },
  });
}
