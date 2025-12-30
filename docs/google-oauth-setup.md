# Google OAuth Setup Guide

This guide walks you through obtaining Google OAuth credentials for NextAuth.js.

## Prerequisites

- A Google account
- Access to Google Cloud Console (https://console.cloud.google.com)

## Step-by-Step Instructions

### Step 1: Create or Select a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click the project dropdown at the top of the page
3. Click **"New Project"** (or select an existing project)
4. Enter a project name (e.g., "CashFlow App")
5. Click **"Create"**

### Step 2: Enable Google Identity API

1. In the Google Cloud Console, go to **"APIs & Services" > "Library"**
2. Search for **"Google Identity"** or **"Google+ API"**
3. Click on **"Google Identity"** (or **"Google+ API"**)
4. Click **"Enable"**

> **Note:** Google+ API is deprecated but still works. If you see "Google Identity Services API", use that instead.

### Step 3: Configure OAuth Consent Screen

1. Go to **"APIs & Services" > "OAuth consent screen"**
2. Choose **"External"** (unless you have a Google Workspace account, then choose "Internal")
3. Click **"Create"**
4. Fill in the required information:
   - **App name**: CashFlow (or your app name)
   - **User support email**: Your email address
   - **Developer contact information**: Your email address
5. Click **"Save and Continue"**
6. On the **"Scopes"** page, click **"Add or Remove Scopes"**
   - Add: `email`, `profile`, `openid`
   - These are usually pre-selected
7. Click **"Update"**, then **"Save and Continue"**
8. On the **"Test users"** page (if External):
   - Add your own email address as a test user
   - This allows you to test the OAuth flow before publishing
9. Click **"Save and Continue"** through the remaining screens

### Step 4: Create OAuth 2.0 Credentials

1. Go to **"APIs & Services" > "Credentials"**
2. Click **"+ CREATE CREDENTIALS"** at the top
3. Select **"OAuth client ID"**
4. If prompted, choose **"Web application"** as the application type
5. Fill in the details:
   - **Name**: CashFlow Web Client (or any descriptive name)
   - **Authorized JavaScript origins**:
     - `http://localhost:3000` (for local development)
     - `http://localhost:4000` (for test server)
     - Add your production URL when ready (e.g., `https://yourdomain.com`)
   - **Authorized redirect URIs**:
     - `http://localhost:3000/api/auth/callback/google`
     - `http://localhost:4000/api/auth/callback/google`
     - Add your production callback URL when ready (e.g., `https://yourdomain.com/api/auth/callback/google`)
6. Click **"Create"**

### Step 5: Copy Your Credentials

After creating the OAuth client, you'll see a popup with:
- **Your Client ID** (looks like: `123456789-abcdefghijklmnop.apps.googleusercontent.com`)
- **Your Client Secret** (looks like: `GOCSPX-abcdefghijklmnopqrstuvwxyz`)

**Important:** Copy both values immediately - you won't be able to see the Client Secret again!

### Step 6: Add Credentials to Your .env File

1. Open your `.env` file in the project root
2. Add the following lines:

```bash
GOOGLE_CLIENT_ID=your-client-id-here
GOOGLE_CLIENT_SECRET=your-client-secret-here
```

Replace `your-client-id-here` and `your-client-secret-here` with the actual values from Step 5.

### Step 7: Restart Your Development Server

After adding the credentials, restart your Next.js development server:

```bash
npm run dev
```

### Step 8: Test the Integration

1. Navigate to `http://localhost:3000`
2. You should be redirected to the login page
3. Click **"Sign in with Google"**
4. You should see the Google sign-in page
5. After signing in, you should be redirected back to your app

## Troubleshooting

### "Error 400: redirect_uri_mismatch"

This means the redirect URI in your request doesn't match what's configured in Google Cloud Console.

**Solution:**
1. Go to **"APIs & Services" > "Credentials"** in Google Cloud Console
2. Click on your OAuth 2.0 Client ID
3. Make sure the **Authorized redirect URIs** includes:
   - `http://localhost:3000/api/auth/callback/google`
   - `http://localhost:4000/api/auth/callback/google` (if using test server)
4. Click **"Save"**
5. Wait a few minutes for changes to propagate
6. Try again

### "Error 403: access_denied"

This usually means:
- The app is in testing mode and your email isn't added as a test user
- The OAuth consent screen isn't properly configured

**Solution:**
1. Go to **"APIs & Services" > "OAuth consent screen"**
2. Add your email to the **"Test users"** list
3. Make sure you've completed all required steps in the consent screen setup

### Credentials Not Working

**Check:**
1. Make sure `.env` file is in the project root (not in `src/` or elsewhere)
2. Verify there are no extra spaces or quotes around the values
3. Restart your development server after adding credentials
4. Check that the environment variables are being loaded (you can temporarily add a `console.log` to verify)

## Production Setup

When deploying to production:

1. Add your production domain to **Authorized JavaScript origins**:
   - `https://yourdomain.com`

2. Add your production callback URL to **Authorized redirect URIs**:
   - `https://yourdomain.com/api/auth/callback/google`

3. Update your production environment variables with the same `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`

4. Consider publishing your OAuth app (if using External user type) to allow any Google user to sign in

## Security Notes

- **Never commit** your `.env` file to version control
- The `.env` file should already be in `.gitignore`
- Keep your Client Secret secure - treat it like a password
- If your Client Secret is compromised, delete the old credentials and create new ones

## Next Steps

After setting up Google OAuth, you can optionally set up Apple Sign-In following a similar process. See `docs/apple-oauth-setup.md` (if created) for Apple-specific instructions.

