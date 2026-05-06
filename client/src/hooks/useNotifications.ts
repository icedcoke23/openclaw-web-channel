import { useState, useCallback, useEffect } from 'react';

export type NotificationPermission = 'default' | 'granted' | 'denied';

interface NotificationOptions {
  body?: string;
  icon?: string;
  tag?: string;
  requireInteraction?: boolean;
  onClick?: () => void;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    // Check if notifications are supported
    if (!('Notification' in window)) {
      setSupported(false);
      return;
    }

    // Get current permission
    setPermission(Notification.permission as NotificationPermission);
  }, []);

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    if (!supported) {
      return 'denied';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
      return result as NotificationPermission;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      return 'denied';
    }
  }, [supported]);

  const showNotification = useCallback((title: string, options: NotificationOptions = {}) => {
    if (!supported || permission !== 'granted') {
      return null;
    }

    try {
      const notification = new Notification(title, {
        body: options.body,
        icon: options.icon || '/vite.svg',
        tag: options.tag,
        requireInteraction: options.requireInteraction ?? false,
      });

      if (options.onClick) {
        notification.onclick = () => {
          options.onClick?.();
          notification.close();
          // Focus the window
          window.focus();
        };
      }

      // Auto-close after 5 seconds if not requiring interaction
      if (!options.requireInteraction) {
        setTimeout(() => {
          notification.close();
        }, 5000);
      }

      return notification;
    } catch (error) {
      console.error('Failed to show notification:', error);
      return null;
    }
  }, [supported, permission]);

  const isEnabled = permission === 'granted';

  return {
    permission,
    supported,
    isEnabled,
    requestPermission,
    showNotification,
  };
}

export default useNotifications;
