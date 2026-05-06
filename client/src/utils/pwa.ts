/**
 * PWA Utilities
 * Service worker registration and PWA-related functionality
 */

export interface PWAState {
  isOnline: boolean;
  isInstallable: boolean;
  isInstalled: boolean;
  deferredPrompt: Event | null;
}

// PWA state listeners
const listeners = new Set<(state: PWAState) => void>();
let currentState: PWAState = {
  isOnline: navigator.onLine,
  isInstallable: false,
  isInstalled: false,
  deferredPrompt: null,
};

function notifyListeners() {
  listeners.forEach((listener) => listener({ ...currentState }));
}

export function subscribeToPWAState(callback: (state: PWAState) => void): () => void {
  listeners.add(callback);
  callback({ ...currentState });
  return () => listeners.delete(callback);
}

export function getPWAState(): PWAState {
  return { ...currentState };
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.log('[PWA] Service workers not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
    });

    console.log('[PWA] Service worker registered:', registration.scope);

    // Handle updates
    registration.addEventListener('updatefound', () => {
      const newWorker = registration.installing;
      if (newWorker) {
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            console.log('[PWA] New version available');
            // Could show update notification here
          }
        });
      }
    });

    return registration;
  } catch (error) {
    console.error('[PWA] Service worker registration failed:', error);
    return null;
  }
}

/**
 * Unregister the service worker
 */
export async function unregisterServiceWorker(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    const result = await registration.unregister();
    console.log('[PWA] Service worker unregistered:', result);
    return result;
  } catch (error) {
    console.error('[PWA] Service worker unregistration failed:', error);
    return false;
  }
}

/**
 * Check if the app is installed (standalone mode)
 */
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

/**
 * Prompt the user to install the PWA
 */
export async function promptInstall(): Promise<boolean> {
  const deferredPrompt = currentState.deferredPrompt as unknown as {
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  } | null;

  if (!deferredPrompt) {
    console.log('[PWA] No install prompt available');
    return false;
  }

  try {
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    // Reset the deferred prompt
    currentState.deferredPrompt = null;
    currentState.isInstallable = false;
    notifyListeners();

    if (outcome === 'accepted') {
      console.log('[PWA] User accepted install');
      currentState.isInstalled = true;
      notifyListeners();
      return true;
    } else {
      console.log('[PWA] User dismissed install');
      return false;
    }
  } catch (error) {
    console.error('[PWA] Install prompt failed:', error);
    return false;
  }
}

/**
 * Initialize PWA functionality
 */
export function initPWA(): void {
  // Listen for online/offline events
  window.addEventListener('online', () => {
    console.log('[PWA] App is online');
    currentState.isOnline = true;
    notifyListeners();
  });

  window.addEventListener('offline', () => {
    console.log('[PWA] App is offline');
    currentState.isOnline = false;
    notifyListeners();
  });

  // Listen for beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('[PWA] Install prompt available');
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Store the event for later use
    currentState.deferredPrompt = e;
    currentState.isInstallable = true;
    notifyListeners();
  });

  // Listen for app installed event
  window.addEventListener('appinstalled', () => {
    console.log('[PWA] App was installed');
    currentState.deferredPrompt = null;
    currentState.isInstallable = false;
    currentState.isInstalled = true;
    notifyListeners();
  });

  // Check if already installed
  if (isStandalone()) {
    currentState.isInstalled = true;
  }

  // Listen for display mode changes
  window.matchMedia('(display-mode: standalone)').addEventListener('change', (e) => {
    currentState.isInstalled = e.matches;
    notifyListeners();
  });

  // Register service worker
  registerServiceWorker();
}

/**
 * Update the service worker
 */
export async function updateServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  await registration.update();
  console.log('[PWA] Service worker updated');
}

/**
 * Skip waiting and activate new service worker
 */
export async function skipWaiting(): Promise<void> {
  if (!('serviceWorker' in navigator)) {
    return;
  }

  const registration = await navigator.serviceWorker.ready;
  if (registration.waiting) {
    registration.waiting.postMessage('SKIP_WAITING');
  }
}

/**
 * Check for app updates
 */
export async function checkForUpdates(): Promise<boolean> {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.update();
    
    // Check if there's a waiting worker
    if (registration.waiting) {
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('[PWA] Check for updates failed:', error);
    return false;
  }
}
