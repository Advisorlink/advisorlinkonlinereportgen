import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

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
      const isNative = typeof (window as any).Capacitor?.isNativePlatform === 'function'
        && (window as any).Capacitor.isNativePlatform();
      if (!isNative) return;

      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        let perm = await PushNotifications.checkPermissions();
        if (perm.receive === 'prompt') perm = await PushNotifications.requestPermissions();
        if (perm.receive !== 'granted') return;

        await PushNotifications.register();

        const regHandle = await PushNotifications.addListener('registration', async (t) => {
          await supabase.from('device_tokens').upsert(
            { user_id: user.id, token: t.value, platform: 'android' },
            { onConflict: 'token' },
          );
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
