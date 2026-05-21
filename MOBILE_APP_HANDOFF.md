# Android Mobile App — Developer Handoff

This project ships as a web app **and** as a native Android APK via
[Capacitor](https://capacitorjs.com/). All scaffolding is already in the repo.
Push notifications use **Firebase Cloud Messaging (FCM)** and are wired through
the `send-push` edge function.

---

## 1. Prerequisites (developer's machine)

- Node 20+ and `npm` (or `bun`)
- Android Studio (latest) — installs the Android SDK
- JDK 17 (bundled with current Android Studio)
- Google account for Firebase

---

## 2. First-time setup

```bash
git clone <repo-url>
cd <repo>
npm install
npx cap add android        # creates the /android folder (first time only)
```

### Before building a production APK
Open `capacitor.config.ts` and **comment out** the `server.url` line. That URL
is only used for live-reload during web development; in production the app
must load the bundled `dist/` assets.

```bash
npm run build              # builds dist/
npx cap sync android       # copies web build + plugins into the Android project
npx cap open android       # opens Android Studio
```

In Android Studio: **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
The debug APK lands at `android/app/build/outputs/apk/debug/app-debug.apk`.

For a Play Store release, configure a signing key in
`android/app/build.gradle` and use **Build → Generate Signed Bundle / APK**.

---

## 3. Firebase / Push Notifications setup

The push pipeline:

```
SMS or email arrives → existing edge function → invokes `send-push`
→ `send-push` reads device_tokens table → calls FCM HTTP v1 → phone buzzes
```

### 3a. Create the Firebase project
1. <https://console.firebase.google.com> → **Add project**.
2. Inside the project: **Add app → Android**.
   - Package name **must** match `capacitor.config.ts` `appId`:
     `app.lovable.8d1f136076d445e5b6d4568b6503cfde`
3. Download the generated **`google-services.json`** into
   `android/app/google-services.json`.
4. Wire up Google services in Gradle:
   - `android/build.gradle` → `buildscript.dependencies`:
     `classpath 'com.google.gms:google-services:4.4.2'`
   - `android/app/build.gradle` → bottom of file:
     `apply plugin: 'com.google.gms.google-services'`
5. `npx cap sync android` and rebuild.

### 3b. Create a service account for the server
1. Firebase Console → ⚙️ **Project settings → Service accounts** →
   **Generate new private key**. Saves a JSON file.
2. In Lovable: **Cloud → Edge Functions → Secrets**, add:
   - `FCM_PROJECT_ID` — the Firebase project ID
   - `FCM_SERVICE_ACCOUNT` — the **entire JSON file contents** as one string

`send-push` starts working as soon as both secrets are set.

---

## 4. Wiring push triggers

The edge function `send-push` accepts:
```json
{ "user_id": "uuid", "title": "...", "body": "...", "data": { "route": "/messages" } }
```

To notify on inbound SMS, append this to
`supabase/functions/sms-inbound/index.ts` (and the Telnyx variant) after the
message is persisted:

```ts
await supabase.functions.invoke('send-push', {
  body: {
    user_id: ownerUserId,           // app_config.owner_user_id
    title: `SMS from ${fromNumber}`,
    body: messageText.slice(0, 140),
    data: { route: '/sms-hub' },
  },
});
```

Same pattern for inbound email replies — invoke `send-push` from whichever
function processes them.

---

## 5. Mounting the registration hook

Add this once inside the authenticated tree (e.g. in `ProtectedApp.tsx`):

```tsx
import { usePushNotifications } from '@/hooks/usePushNotifications';
// inside the component body:
usePushNotifications();
```

On web it's a no-op; on Android it asks for permission, stores the FCM token
in `device_tokens`, and routes notification taps via `data.route`.

---

## 6. Local development loop

- `npm run dev` for browser-only work (push is a no-op).
- Keep `server.url` in `capacitor.config.ts` enabled and run
  `npx cap run android` so the installed APK live-reloads from the sandbox.
- After Lovable pushes code: `git pull && npx cap sync android`. Reinstall
  only needed when native plugins change; pure web changes flow automatically.

---

## 7. Files added for the mobile build

| Path | Purpose |
|------|---------|
| `capacitor.config.ts` | Capacitor app config (id, name, plugins) |
| `src/hooks/usePushNotifications.tsx` | Registers device, stores FCM token, handles taps |
| `supabase/functions/send-push/index.ts` | Server-side FCM v1 sender |
| `device_tokens` table | One row per device per user (RLS enforced) |

---

## 8. Pre-flight checklist

- [ ] `server.url` commented out in `capacitor.config.ts`
- [ ] `google-services.json` in `android/app/`
- [ ] `FCM_PROJECT_ID` and `FCM_SERVICE_ACCOUNT` set in Lovable secrets
- [ ] `usePushNotifications()` mounted inside the auth-gated tree
- [ ] App icon + splash replaced in `android/app/src/main/res/`
- [ ] Signing key configured for release builds
