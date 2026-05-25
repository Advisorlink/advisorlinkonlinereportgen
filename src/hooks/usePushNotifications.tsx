import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

type CapacitorBridge = { isNativePlatform?: () => boolean; getPlatform?: () => string };

/**
 * Registers the device for push notifications when running as a native app
 * (Capacitor). On web this is a no-op.
 */
export function usePushNotifications() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;
    let cleanup: (() => void) | undefined;

    (async () => {
      const capacitor = (window as Window & { Capacitor?: CapacitorBridge }).Capacitor;
      const isNative = typeof capacitor?.isNativePlatform === 'function'
        && capacitor.isNativePlatform();
      if (!isNative) return;
      const nativePlatform = capacitor?.getPlatform?.();
      const platform = nativePlatform === 'ios' || nativePlatform === 'android' ? nativePlatform : 'android';

      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions();
        if (perm.receive !== 'granted') return;

        await PushNotifications.register();

        await PushNotifications.createChannel?.({
          id: 'calls',
          name: 'Incoming calls',
          description: 'CRM phone call alerts',
          importance: 5,
          visibility: 1,
          sound: 'default',
          vibration: true,
          lights: true,
        });

        const regHandle = await PushNotifications.addListener('registration', async (t) => {
          await supabase.functions.invoke('register-device-token', {
            body: {
              user_id: user.id,
              token: t.value,
              platform,
              token_type: 'fcm',
              device_name: navigator.userAgent,
            },
          });
        });

        const errHandle = await PushNotifications.addListener('registrationError', (err) => {
          console.error('Push registration error', err);
        });

        const tapHandle = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action) => {
            const route = action.notification.data?.route;
            if (route && typeof route === 'string') {
              window.location.assign(route);
            }
          },
        );

        cleanup = () => {
          regHandle.remove();
          errHandle.remove();
          tapHandle.remove();
        };
      } catch (e) {
        console.error('Push init failed', e);
      }
    })();

    return () => cleanup?.();
  }, [user]);
}
