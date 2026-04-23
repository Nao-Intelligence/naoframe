# naoframe

Wireframe-Review-Tool von Nao Intelligence. Kunden gehen durch User Stories eines
HTML-Wireframes, geben Text- oder Audio-Feedback (per Whisper transkribiert) und
akzeptieren oder lehnen die Story ab.

## Architektur

- **Next.js 16 App Router** (TypeScript, Tailwind 4)
- **Supabase** für Postgres, Auth (Magic Link für Nao-Team) und Storage (Audio-Blobs)
- **Drizzle ORM** für Schema und Queries
- **OpenAI Whisper** für serverseitige Audio-Transkription
- **Deployment:** Vercel + Supabase

## Setup

### 1. Supabase-Projekt

1. Neues Supabase-Projekt anlegen.
2. Unter _Authentication → Providers_ den **Email-Provider** aktivieren (Confirm email optional) und unter _Authentication → Sign In_ **„Enable email signups" deaktivieren** (damit sich niemand selbst registrieren kann).
3. Unter _Storage_ zwei Buckets anlegen, beide **private**:
   - `feedback-audio` — für hochgeladene Audio-Feedbacks
   - `wireframes` — für hochgeladene HTML-Bundles (wird von `/wireframes/[projectId]/[...path]`-Proxy ausgeliefert)
4. Unter _Project Settings → Database_ die Connection Strings kopieren:
   - `Session pooler` für `DATABASE_URL` (Runtime)
   - `Direct connection` für `DIRECT_DATABASE_URL` (Migrationen)

### 2. Environment

```bash
cp .env.example .env.local
```

Fülle `.env.local` aus (siehe Kommentare in `.env.example`).

User-Management läuft ausschließlich über Supabase — **jeder in Supabase angelegte
Auth-User ist Admin**. Self-Signup also unbedingt in Supabase deaktivieren (siehe
unten), damit sich niemand eigenständig registriert.

### 3. Dependencies + DB-Schema

```bash
npm install
npm run db:push        # legt alle Tabellen in Supabase an
```

### 4. Dev-Server

```bash
npm run dev
```

→ `http://localhost:3000`

## Nutzung

### Admin-User anlegen (einmalig pro neuem Teammitglied)

User-Management läuft komplett über Supabase. Es gibt **keine Self-Service-Registrierung** —
neue Admins werden im Supabase-Dashboard hinzugefügt.

1. Supabase-Dashboard → **Authentication → Users → „Add user" → „Create new user"**.
2. E-Mail eintragen und ein temporäres Passwort vergeben, **„Auto Confirm User"** anhaken.
3. Der User erhält das temporäre Passwort von dir über einen sicheren Kanal und kann es nach
   dem ersten Login über _Passwort vergessen?_ → Reset-Link → neues Passwort ändern.

Alternativ: Supabase-UI → „Send invite" (die User bekommt einen Invite-Link). Dann muss das
Email-Template von Supabase auf `{{ .SiteURL }}/auth/callback?next=/auth/update-password`
verweisen.

**Public Signup abschalten** (empfohlen): Dashboard → _Authentication → Sign In / Providers
→ Email_ → **„Enable email signups" auf off**.

### Admin-Flow

1. `/login` öffnen → E-Mail + Passwort eingeben → `/admin`.
2. Projekt anlegen: Name, Kunde, Wireframe-Basis-URL (z.B. `https://wire.acme-preview.nao.dev`).
3. User Stories anlegen mit Titel, Beschreibung, Akzeptanzkriterien und `start_path`
   (z.B. `/onboarding/step-1`, `?view=checkout`, `#step-3`).
4. Share-Link erzeugen — der rohe Token wird **nur einmal** angezeigt.
5. Link an den Kunden schicken.

**Passwort vergessen?** Link auf der Login-Seite → E-Mail eingeben → Reset-Link per Mail →
Klick führt zu `/auth/update-password` → neues Passwort setzen.

### Reviewer (Kunde)

1. Share-Link öffnet `/r/<token>` — kein Login nötig.
2. Links: Wireframe im iframe. Rechts: Liste der Stories.
3. Story klicken → iframe springt auf `base + start_path`, rechts erscheinen
   Details und Feedback-Panel.
4. Text-Feedback tippen oder auf „Aufnahme starten" klicken und Audio
   einsprechen — nach Stop wird serverseitig transkribiert.
5. „Akzeptieren" oder „Ablehnen" drückt eine Entscheidung. Ablehnung erfordert
   mindestens ein Feedback.

## Ordnerstruktur

```
app/
  admin/                           Admin-Bereich (auth-gated)
    projects/[id]/                 Projekt-Detail, Stories, Share-Links
    actions.ts                     Server-Actions für alle Admin-Mutationen
  login/                           Email+Passwort-Login + Passwort-Reset-Request
  auth/callback/                   Supabase Code-Exchange (Reset- und Invite-Links)
  auth/update-password/            Neues Passwort setzen (nach Reset oder Invite)
  r/[token]/                       Public Reviewer-UI
  api/r/[token]/stories/[id]/
    feedback/                      POST Text-Feedback
    audio/                         POST Audio → Whisper → Storage + DB
    decision/                      POST Accept/Reject
components/reviewer/               Client-Components für /r/[token]
drizzle/schema.ts                  DB-Schema + Types
lib/
  db.ts                            Drizzle-Client (Supabase Postgres)
  supabase/                        Server/Admin/Browser-Clients
  whisper.ts                       OpenAI-Whisper-Wrapper
  share-token.ts                   Token-Generierung + Hash
  review-session.ts                Reviewer-Session per Cookie
  api-guard.ts                     Token + Story-Guard für Reviewer-APIs
proxy.ts                           Supabase-Session-Refresh + Referrer-Policy
```

## Deployment

1. Repo auf Vercel verbinden.
2. Alle Env-Vars aus `.env.example` in Vercel setzen (mindestens Production).
3. `npm run db:push` einmal lokal gegen die Produktions-DB laufen lassen.
4. In Supabase unter _Authentication → URL Configuration_ die Vercel-Domain als
   _Site URL_ und erlaubte Redirect-URL (`https://<domain>/auth/callback`) eintragen.
5. `NEXT_PUBLIC_APP_URL=https://<domain>` in Production setzen.

## Bekannte Risiken

- **iframe-Blockierung:** Viele Hosts setzen `X-Frame-Options: DENY` oder
  `Content-Security-Policy: frame-ancestors 'none'`. Das UI zeigt dann einen
  Fallback „In neuem Tab öffnen". Abhilfe: im Wireframe-Hosting die Header
  anpassen (`frame-ancestors https://<naoframe-domain>`).
- **Safari/iOS MediaRecorder:** Aufnahme funktioniert in aktuellen Safari-Versionen,
  ältere iOS-Geräte können Probleme machen. Die UI blendet den Recorder
  automatisch aus, wenn `MediaRecorder` nicht unterstützt wird.
- **Token-Leak:** `/r/<token>` setzt `Referrer-Policy: no-referrer` via
  `proxy.ts`, damit der Token nicht als Referer an den Wireframe-Host fliesst.

## Next Steps (Post-MVP)

- Rate-Limiting auf `/r/[token]` (z.B. via Upstash).
- Admin-Export (CSV) aller Feedbacks pro Projekt.
- GDPR-Delete: Projekt-Löschen inkl. Storage-Objekte.
- Projektweite Abnahme-Markierung im Admin.
- postMessage-Navigation für kooperierende Wireframes (kein iframe-Reload).
