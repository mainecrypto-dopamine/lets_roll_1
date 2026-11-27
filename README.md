# Let's Roll 🛞

A family ride agenda for you and your buddy, in English and Thai. Tap your places 1, 2, 3, pick a time, hit **Let's Roll!**, and your buddy sees the day's plan in Thai on his own phone, live.

It installs on both phones like an app ("Add to Home Screen"), and it runs on two free services:

- **Supabase** keeps the trips, places and contacts, handles sign-in, and pushes changes to every phone instantly.
- **Vercel** hosts the app at its own web address.

## What's in here

| File | What it does |
|---|---|
| `index.html` | The whole app (planner, stickers, TIME TO RAGE, Bring me, SOS, Send via LINE / WhatsApp) |
| `backend.js` | Connects the app to Supabase: sign-in screen, live sync, translations |
| `config.js` | Your Supabase address and public key (step 2 below) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Make it installable with the off-road wheel icon |
| `supabase/schema.sql` | Creates the database and its rules (only invited emails get in) |
| `supabase/functions/ask/` | Lets the app ask Claude for Thai translations |

Your family's addresses, phone numbers and photos are **not** in this repo. They load into your private database from a separate file.

## Setup (about 15 minutes, once)

### 1. Create the database
1. Sign in at [supabase.com](https://supabase.com) with GitHub, then **New project**: name `lets-roll`, region **Southeast Asia (Singapore)**.
2. Open **SQL Editor**, paste all of `supabase/schema.sql`, and press **Run**.
3. Paste your private starting-data file (places, photos, contacts and team emails), and press **Run** again.

### 2. Connect the app
1. In Supabase, open **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key into `config.js`.

### 3. Turn on email sign-in codes
1. Go to **Authentication → Emails → Magic Link** template.
2. Add this line so people can type a code instead of tapping the link (works better on phones):
   `Your code: {{ .Token }}`
3. Under **Authentication → URL Configuration**, set **Site URL** to your app's address from step 5.

### 4. Turn on Thai translation
1. Get an API key at [console.anthropic.com](https://console.anthropic.com).
2. In Supabase, go to **Edge Functions → Secrets** and add `ANTHROPIC_API_KEY`.
3. Create a function named `ask` (**Edge Functions → Deploy a new function → Via editor**), paste `supabase/functions/ask/index.ts`, and deploy.

### 5. Put it online
1. At [vercel.com](https://vercel.com), sign in with GitHub, then **Add New → Project → lets_roll_1 → Deploy**. No settings needed.
2. You get an address like `lets-roll-1.vercel.app`. Open it on each phone, sign in, then **Share → Add to Home Screen**.

### 6. Automatic LINE messages (optional, recommended)
Personal LINE accounts can't be sent from by apps, so Let's Roll sends from its own **LINE Official Account**.
1. Go to [manager.line.biz](https://manager.line.biz) and create an Official Account called **Let's Roll**. Pick the free plan.
2. In its **Settings → Messaging API**, turn on the Messaging API. Then open the [LINE Developers Console](https://developers.line.biz/console/) → your channel → **Messaging API** tab, and issue a **Channel access token (long-lived)**. Copy the **Channel secret** from the **Basic settings** tab.
3. In Supabase, go to **Edge Functions → Secrets** and add `LINE_CHANNEL_ACCESS_TOKEN` and `LINE_CHANNEL_SECRET`. Never put these in `config.js` or anywhere in this repo.
4. Deploy two functions from `supabase/functions/`: **line-send**, and **line-webhook** with **Enforce JWT verification turned OFF**.
5. In the LINE Developers Console, set the **Webhook URL** to `https://YOUR-PROJECT.supabase.co/functions/v1/line-webhook`, then turn **Use webhook** on.
6. In `config.js`, set `lineEnabled: true`.
7. Have your buddy and family **add the Let's Roll LINE account as a friend** (scan its QR code in LINE Official Account Manager). In the app, open **Send via LINE / WhatsApp → Edit** for each person and pick their LINE name. Then the green **Send on LINE now** button sends instantly.

### 7. Sign in with Google (optional)
1. In [Google Cloud Console](https://console.cloud.google.com/apis/credentials), create a project, set up the **OAuth consent screen** (External, app name Let's Roll), then **Create credentials → OAuth client ID → Web application**.
2. Under **Authorized redirect URIs**, add `https://vtwbpuftoktwddkehqxb.supabase.co/auth/v1/callback`.
3. Copy the **Client ID** and **Client secret** into Supabase: **Authentication → Sign In / Providers → Google**, turn it on, and save.
4. In Supabase **Authentication → URL Configuration**, set the **Site URL** to your app's address.
5. In `config.js`, set `googleSignIn: true`.

### Adding people
Only emails in the `members` table can sign in. Add someone in **SQL Editor**:

```sql
insert into members (email, role, name) values ('name@gmail.com', 'family', 'Mum');
```

Roles: `owner` (sees TIME TO RAGE and Bring me), `buddy`, `family`.

## Quick entry for the buddy (no code, no password)
1. In Supabase, go to **Edge Functions → Deploy a new function → Via editor**, name it `enter`, paste `supabase/functions/enter/index.ts`, turn **Enforce JWT verification OFF**, and deploy.
2. Add the buddy's email in the app under ☰ → Team with role **buddy**.
3. Send the buddy `https://YOUR-APP/#enter=their@email.com`. Opening it signs them in once; after that the app opens straight in.
Only members with role `buddy` can use quick entry. Anyone who has that link can open the buddy view, so share it only with the buddy.
