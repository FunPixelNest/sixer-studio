# Sixer Studio 🏏

Custom cricket jersey store with an **admin panel**, **customer accounts** and **WhatsApp ordering**. No online payment: customers book, the order is sent to your WhatsApp, and you reply with the delivery date.

- **Store:** `index.html`
- **Admin panel:** `admin.html` (also linked in the store's footer)

## How it works

1. **You (admin)** add products with photos, prices and sizes, and set your WhatsApp number in *Settings*.
2. **Customer** picks a jersey (or designs one in the Design Studio), chooses a size and adds a name/number.
3. Customer taps **Book order**, logs in or signs up, and enters their address.
4. The order is saved and WhatsApp opens with the full order text addressed to **your number**. They tap send.
5. In **Admin → Orders** you set the status and **delivery date**, press **Save**, then press **WhatsApp** to send them a ready-written message.
6. The customer also sees the status and delivery date under **My Orders** on the site.

## Demo mode vs live mode

Until `js/config.js` is filled in, the site runs in **demo mode**: everything is stored only in the visitor's own browser. That's fine for showing friends how it looks.

- Demo admin login: `admin@demo.com` / `admin123`

To get real accounts, a shared database and photo storage, connect Supabase (free).

## Go live (about 10 minutes)

### 1. Create a Supabase project
1. Sign up at <https://supabase.com> and create a **New project** (free plan). Pick a region close to you, e.g. Mumbai.
2. Wait about 2 minutes for it to start.

### 2. Create the database
1. Open **SQL Editor → New query**.
2. Open [`supabase/setup.sql`](supabase/setup.sql) from this repo and copy all of it.
3. **On the last line, change `YOUR-EMAIL@example.com` to your own e-mail.** That e-mail becomes the admin.
4. Paste it in and press **Run**. It should say *Success*.

### 3. Connect the website
1. In Supabase go to **Project Settings → API**.
2. Copy the **Project URL** and the **anon public** key.
3. On GitHub, edit [`js/config.js`](js/config.js) (pencil icon), paste both values, and commit:
   ```js
   SUPABASE_URL: 'https://xxxx.supabase.co',
   SUPABASE_ANON_KEY: 'eyJhbGci...'
   ```
   The anon key is meant to be public. Your data is protected by the security rules in `setup.sql`.

### 4. Login settings (recommended)
In Supabase go to **Authentication → Sign In / Providers → Email**:
- Turn **off** "Confirm email" so customers can book right after signing up. If you leave it on, they must click a link in their e-mail first.

Then go to **Authentication → URL Configuration** and set **Site URL** to your website address (step 5). This makes password-reset links work.

### 5. Publish with GitHub Pages
1. Repo **Settings → Pages**.
2. Under **Source** choose **Deploy from a branch**, then select `main` and `/ (root)`, and **Save**.
3. After a minute your site is live at `https://funpixelnest.github.io/sixer-studio/`.
   - Admin panel: `https://funpixelnest.github.io/sixer-studio/admin.html`

### 6. First admin login
1. Open the **store**, click **Login → Create account**, and sign up with the **same e-mail** you put in `setup.sql`.
2. Open `admin.html` and log in.
3. Go to **Settings**, enter your **WhatsApp number**, and save.
4. Go to **Products → Add product** and upload your jersey photos.

To add another admin, run this in the SQL Editor:
```sql
insert into admins (email) values ('friend@example.com');
```

## Features

**Store:** product photos with hover second image, categories, search, sort, wishlist, product share links, name and number personalisation, cart, login/sign-up, password reset, saved address, **My Orders** with status and delivery date, dark mode, mobile friendly.

**Design Studio:** 8 patterns, colour palettes and custom colours, polo or round collar, live front/back preview, PNG download, share link.

**Team builder:** squad list, paste a player list, duplicate-number warnings, bulk price tiers (set in admin), CSV export.

**Admin:** photo upload with drag & drop (resized automatically), reorder photos and products, show/hide, duplicate products; orders dashboard with status filters, search, delivery date, note to customer, one-tap WhatsApp message, CSV export, and an alert when new orders arrive; settings for store name, WhatsApp number, announcement bar, booking note and custom-jersey prices.

## Files

| File | What it is |
|---|---|
| `index.html`, `js/store.js` | Customer store |
| `admin.html`, `js/admin.js` | Admin panel |
| `js/data.js` | Talks to Supabase (or demo storage) |
| `js/jersey.js` | Jersey artwork and shared helpers |
| `js/config.js` | **Your Supabase keys go here** |
| `css/style.css` | All styles |
| `supabase/setup.sql` | Database, security rules and photo storage |

## Admin app (Android)

**Sixer Admin** is an Android app that opens the admin panel full screen. It's only for the shop owner; customers use the website.

- **Download:** `https://funpixelnest.github.io/sixer-studio/downloads/sixer-admin.apk`. Open the link on the phone and install it. Android will ask you to allow installs from your browser the first time.
- Log in with your admin e-mail. The app keeps you logged in.
- **WhatsApp** buttons open WhatsApp, phone numbers open the dialler, and **View store** opens the browser.
- **Add product → photos** opens the phone gallery. You can pick several photos at once.
- **Export CSV** saves the orders file to the phone's **Downloads** folder.
- The phone's back button closes pop-ups, then exits.
- New orders are fetched every time you open the app (and every minute while it's open).

The app loads the live admin page, so any website change is in the app instantly, with no app update needed.

### Building the app
Source code is in `android-admin/`. You need the Android SDK and the signing key `sixer-admin-release.jks`, which is **not** in this repo. Keep it safe: future updates must be signed with the same key.
```
cd android-admin
# create keystore.properties with storeFile, storePassword, keyAlias, keyPassword
gradle assembleRelease
# → app/build/outputs/apk/release/app-release.apk
```
