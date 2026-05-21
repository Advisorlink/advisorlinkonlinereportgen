// Send a push notification via Firebase Cloud Messaging (HTTP v1 API).
//
// Required secrets (set after creating a Firebase project):
//   FCM_PROJECT_ID         - Firebase project ID (e.g. "advisorlink-app")
//   FCM_SERVICE_ACCOUNT    - Full JSON of a Firebase service account key
//
// Call from another edge function (e.g. sms-inbound) like:
//   await supabase.functions.invoke('send-push', {
//     body: { user_id, title, body, data: { route: '/messages' } }
//   })

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PushPayload {
  user_id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

async function getAccessToken(serviceAccountJson: string): Promise<string> {
  const sa = JSON.parse(serviceAccountJson);
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const claim = {
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const b64url = (buf: ArrayBuffer | Uint8Array | string) => {
    const bytes = typeof buf === 'string'
      ? new TextEncoder().encode(buf)
      : buf instanceof ArrayBuffer ? new Uint8Array(buf) : buf;
    let str = '';
    bytes.forEach((b) => (str += String.fromCharCode(b)));
    return btoa(str).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  };

  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(claim))}`;
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const keyBytes = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(unsigned));
  const jwt = `${unsigned}.${b64url(sig)}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Google token error: ${JSON.stringify(json)}`);
  return json.access_token as string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const projectId = Deno.env.get('FCM_PROJECT_ID');
    const saJson = Deno.env.get('FCM_SERVICE_ACCOUNT');
    if (!projectId || !saJson) {
      return new Response(
        JSON.stringify({ error: 'FCM_PROJECT_ID or FCM_SERVICE_ACCOUNT not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    const payload = (await req.json()) as PushPayload;
    if (!payload.user_id || !payload.title || !payload.body) {
      return new Response(JSON.stringify({ error: 'user_id, title, body required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: tokens, error } = await supabase
      .from('device_tokens')
      .select('token, platform')
      .eq('user_id', payload.user_id);

    if (error) throw error;
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0, reason: 'no devices' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const accessToken = await getAccessToken(saJson);
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;

    const results = await Promise.allSettled(
      tokens.map((t) =>
        fetch(url, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: t.token,
              notification: { title: payload.title, body: payload.body },
              data: payload.data ?? {},
              android: { priority: 'HIGH' },
            },
          }),
        }).then(async (r) => {
          if (!r.ok) {
            const txt = await r.text();
            if (r.status === 404 || r.status === 400) {
              await supabase.from('device_tokens').delete().eq('token', t.token);
            }
            throw new Error(`FCM ${r.status}: ${txt}`);
          }
          return r.json();
        }),
      ),
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - sent;
    return new Response(JSON.stringify({ sent, failed }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('send-push error', e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
