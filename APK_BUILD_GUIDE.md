# 📱 How to Build the Last Island APK

This guide walks you through turning your Last Island web app into an installable Android APK — fully automated via GitHub Actions.

---

## Overview

Your app is a **Next.js web app**. To make an APK, we wrap it as a **TWA (Trusted Web Activity)** using Google's **Bubblewrap** tool. The TWA opens your deployed website inside a full-screen Chrome container that looks and feels like a native app — including **push notifications that work when the app is closed**.

```
Your Next.js app  →  Deploy to Vercel (HTTPS)  →  Bubblewrap wraps it as TWA  →  Signed APK
```

---

## Step 1 — Deploy your app to Vercel (free)

The APK needs a live HTTPS URL. Vercel is free and perfect for Next.js.

1. Push your code to a GitHub repository:
   ```bash
   git init
   git add .
   git commit -m "Last Island chat app"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/last-island-chat.git
   git push -u origin main
   ```

2. Go to [vercel.com](https://vercel.com) → Sign in with GitHub

3. Click **"Add New Project"** → Import your `last-island-chat` repo

4. Framework preset: **Next.js** (auto-detected) → Click **Deploy**

5. Wait ~2 minutes. You'll get a URL like:
   ```
   https://last-island-chat.vercel.app
   ```
   (or `https://last-island-chat-xyz.vercel.app`)

6. **Test it** — open the URL in your phone browser. Log in, create a legion, make sure everything works.

---

## Step 2 — Update the TWA manifest with your URL

Open `twa-manifest.json` in your repo and replace **every** occurrence of `last-island-chat.vercel.app` with your actual Vercel URL.

```json
{
  "host": "YOUR-URL.vercel.app",
  "iconUrl": "https://YOUR-URL.vercel.app/icons/icon-512.png",
  "maskableIconUrl": "https://YOUR-URL.vercel.app/icons/maskable-512.png",
  "webManifestUrl": "https://YOUR-URL.vercel.app/manifest.json",
  "fullScopeUrl": "https://YOUR-URL.vercel.app/"
}
```

Commit and push:
```bash
git add twa-manifest.json
git commit -m "Update TWA manifest with deployed URL"
git push
```

---

## Step 3 — Generate a signing keystore (one-time)

You need a keystore to sign your APK (required for installation and Play Store upload).

### On Mac/Linux:
```bash
keytool -genkey -v -keystore android.keystore -alias android -keyalg RSA -keysize 2048 -validity 10000
```

### On Windows:
```cmd
"%JAVA_HOME%\bin\keytool" -genkey -v -keystore android.keystore -alias android -keyalg RSA -keysize 2048 -validity 10000
```

It will ask for:
- **Keystore password** — pick a strong password, remember it
- **Key password** — same as keystore password is fine
- **Your name, organization, etc.** — fill in anything

This creates a file called `android.keystore`. **Keep this file safe** — you'll need it to publish updates!

### Convert the keystore to base64 (for GitHub Secrets):
```bash
base64 android.keystore > android.keystore.base64
```

Copy the contents of `android.keystore.base64` (a long string of letters/numbers).

---

## Step 4 — Add GitHub Secrets

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add these 4 secrets:

| Secret Name | Value |
|-------------|-------|
| `ANDROID_KEYSTORE_BASE64` | The base64 string from step 3 |
| `ANDROID_KEYSTORE_PASSWORD` | The keystore password you chose |
| `ANDROID_KEY_ALIAS` | `android` (or whatever alias you used) |
| `ANDROID_KEY_PASSWORD` | The key password you chose |

---

## Step 5 — Build the APK automatically

The GitHub Actions workflow (`.github/workflows/build-apk.yml`) runs automatically when you push to `main`. You can also trigger it manually:

1. Go to your GitHub repo → **Actions** tab
2. Click **"Build Android APK"** in the left sidebar
3. Click **"Run workflow"** → **Run workflow**
4. Wait ~5-8 minutes for the build to complete

### Download your APK:

**Option A — As a release:**
- Go to the **Releases** section of your repo (right sidebar on the main page)
- You'll see a release tagged `apk-N` with `last-island.apk` attached
- Click to download

**Option B — As an artifact:**
- Go to **Actions** tab → click the latest successful run
- Scroll down to **Artifacts** → download `last-island-apk`
- Unzip it to get `last-island.apk`

---

## Step 6 — Install on your phone

1. Transfer `last-island.apk` to your Android phone (via USB, email, Google Drive, etc.)

2. On your phone, open **Settings** → **Apps** → **Special access** → **Install unknown apps** → enable it for your file manager/browser

3. Tap the APK file to install

4. Open **"Last Island"** from your app drawer — it launches full-screen like a native app!

5. When you log in, **allow notifications** — this enables raid alarm push notifications even when the app is closed

---

## Alternative: Build the APK locally (without GitHub Actions)

If you prefer to build on your own machine:

```bash
# Install Bubblewrap
npm install -g @bubblewrap/cli

# Initialize the TWA project from your manifest
bubblewrap init --manifest ./twa-manifest.json --directory ./twa-build

# Build the APK
cd ./twa-build
bubblewrap build

# The APK will be at:
# ./twa-build/app/build/outputs/apk/release/app-release.apk
```

---

## Publishing to the Google Play Store (optional)

If you want to publish publicly:

1. Create a [Google Play Developer account](https://play.google.com/console) ($25 one-time fee)

2. Use **Bubblewrap** to create a Play Store-ready bundle:
   ```bash
   bubblewrap build --aab
   ```
   This creates an `.aab` (Android App Bundle) instead of an APK.

3. Upload the `.aab` to the Play Console

4. Fill in the store listing, screenshots, description, etc.

5. Submit for review (usually approved in 1-3 days)

---

## Troubleshooting

### "Digital Asset Links verification failed"
This means your site's `.well-known/assetlinks.json` isn't set up. Bubblewrap generates this automatically — run:
```bash
bubblewrap update
```
And deploy the generated `assetlinks.json` to your site at `/.well-known/assetlinks.json`. On Vercel, just put it in the `public/.well-known/` folder.

### Build fails with "keystore not found"
Make sure you added the `ANDROID_KEYSTORE_BASE64` secret correctly and that the base64 string has no trailing whitespace.

### Notifications don't work in the APK
Push notifications require HTTPS (Vercel provides this automatically). Also make sure the user grants notification permission when they first open the app.

### App shows a browser address bar
This means the TWA isn't verified (Digital Asset Links). Follow the "Digital Asset Links" fix above. Without it, Chrome falls back to a Custom Tab (with address bar) instead of full-screen TWA mode.

---

## Summary

| Step | What | Time |
|------|------|------|
| 1 | Deploy to Vercel | 5 min |
| 2 | Update twa-manifest.json URL | 2 min |
| 3 | Generate keystore | 2 min |
| 4 | Add GitHub secrets | 3 min |
| 5 | Run GitHub Action → download APK | 8 min |
| 6 | Install on phone | 2 min |
| **Total** | | **~20 min** |

Once set up, every time you push code changes, the APK rebuilds automatically and creates a new release. 🎉
