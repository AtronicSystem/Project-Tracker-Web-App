# ELV Project Tracker: web app

This is a real web app with its own login. Staff and outside vendors sign in with an email and password and see only the projects and areas you allow them. All data lives in your own Supabase database, and every permission is checked inside the database, not just in the browser.

```
public/            the website (upload this to Vercel)
  index.html
  app.js
  config.js        ← you edit this one file
  atronic-logo.png, atronic-wordmark.png, favicon.svg  (branding)
supabase/
  schema.sql       ← run this once in Supabase
test/              automated tests (not needed to run the app)
```

Setup takes about 15 minutes. Both services have free plans that are enough for this.

---

## 1. Create the database (Supabase)

1. Go to **supabase.com** → sign up → **New project**. Pick a name (e.g. `atronic-tracker`), set a database password (save it somewhere), and choose the **Mumbai (ap-south-1)** region.
2. Wait for the project to finish setting up, about 2 minutes.
3. Open **SQL Editor** → **New query**. Paste the whole of `supabase/schema.sql` and click **Run**. It should say *Success*.
   - The last lines of the file make **tarun@atronic.co.in** the first admin. To use a different email, change it in the file before running.
4. Open **Project Settings → API** (in newer dashboards: **Project Settings → Data API** and **API Keys**). Copy these two values:
   - **Project URL**, which looks like `https://abcdxyz.supabase.co`
   - **anon public** key, a long string starting with `eyJ…`

## 2. Fill in config.js

Open `public/config.js` and paste in the two values:

```js
window.TRACKER_CONFIG = {
  SUPABASE_URL: 'https://abcdxyz.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOi…',
  COMPANY: 'Atronic'
};
```

The anon key is meant to be public, so it's safe in the website. It can only call the tracker's own functions, and each function checks who is signed in.

## 3. Put the website online (Vercel)

**Easiest option (no software to install):**
1. Go to **github.com** → sign up → **New repository** (e.g. `atronic-tracker`, set to *Private*) → **uploading an existing file** → drag in the **contents of the `public` folder** (`index.html`, `app.js`, `config.js`, `vercel.json`, the two logo `.png` files and `favicon.svg`) → **Commit changes**.
2. Go to **vercel.com** → **Continue with GitHub** → **Add New… → Project** → import `atronic-tracker`. Leave Framework as **Other** and don't set a build command → **Deploy**.
3. You'll get an address like `https://atronic-tracker.vercel.app`. When you later edit a file on GitHub, Vercel updates the site automatically.

**From a terminal:** `cd public && npx vercel --prod`.

## 4. Connect login to your website address

In Supabase, go to **Authentication → URL Configuration**:
- **Site URL**: your Vercel address, e.g. `https://atronic-tracker.vercel.app`
- **Redirect URLs**: add the same address

Then go to **Authentication → Providers → Email** and make sure **Email** is enabled and **Confirm email** is on.

> Supabase's built-in email sender only sends a few emails per hour. That's fine for trying it out. Before you invite many people, set up your own SMTP under **Authentication → Emails → SMTP settings**. Google Workspace, Zoho or any mail provider works.

## 5. First sign-in

1. Open your Vercel address → **Create an account** with `tarun@atronic.co.in`.
2. Click the confirmation link in the email, then sign in. You'll see **Admin** under your name and an **Admins** tab.
3. **Projects → + New project → Import BOQ** to bring in an Excel BOQ or one of your existing tracker files.

## 6. Adding people (staff or outside vendors)

1. Open a project → **Access → + Add person** → type their email → choose a starting role (Site team, View only, Billing, Vendor).
2. Fine-tune each area in the table. The options are **Can edit**, **Needs approval**, **Only see** and **No access**.
3. Send them the website address. They click **Create an account** using **that same email**, confirm it, and the project appears for them.

People not on a project's Access list can't see that project at all, even if they have an account. To add another full admin, use the **Admins** tab.

---

## How it works

- **Who sees what:** admins see everything, including rates. Everyone else sees only projects where their email is listed, and only the areas you allow there. Rates are never sent to non-admins.
- **"Needs approval" entries** go to *Pending update requests*. They count only after an admin approves them.
- **Documents** (drawings, TDS, approval letters, challans, RA bills) are stored privately in Supabase Storage, up to 50 MB per file. Challans need Delivery access and RA bills need Billing access.
- **Deleted projects** stay in *Recently deleted* for 7 days. After that, they're removed permanently the next time an admin opens the app.
- **Backups:** Supabase's free plan doesn't include automatic backups. Use **Export Excel** regularly, or upgrade to Pro for daily backups.

## Running the tests (optional, for developers)

```
cd test && npm install
node sqltest.js          # database permission tests (~54 checks)
node e2e/run.js          # full browser test: admin, vendor, site engineer, stranger
```

The browser test runs the real `app.js` against the real `schema.sql` (in PGlite). It replaces only the login and file-storage transport with a local stand-in.
