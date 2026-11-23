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

### Adding people
Only emails in the `members` table can sign in. Add someone in **SQL Editor**:

```sql
insert into members (email, role, name) values ('name@gmail.com', 'family', 'Mum');
```

Roles: `owner` (sees TIME TO RAGE and Bring me), `buddy`, `family`.
