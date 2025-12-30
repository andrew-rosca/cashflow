# Authentication Troubleshooting

## Issue: Redirected back to login after signing in

### Step 1: Fix NEXTAUTH_SECRET in .env

Your `.env` file currently has a malformed `NEXTAUTH_SECRET` line. It should be:

```bash
NEXTAUTH_SECRET="27M9SrGA+p6VtX9gsA3qYMZJMEVhbCPd+MrajSVaakU="
```

**NOT:**
```bash
NEXTAUTH_SECRET="NEXTAUTH_SECRET="27M9SrGA+p6VtX9gsA3qYMZJMEVhbCPd+MrajSVaakU=""
```

1. Open your `.env` file
2. Find the line starting with `NEXTAUTH_SECRET=`
3. Replace the entire line with:
   ```
   NEXTAUTH_SECRET="27M9SrGA+p6VtX9gsA3qYMZJMEVhbCPd+MrajSVaakU="
   ```
4. Save the file

### Step 2: Verify Your .env File

Your `.env` should have these lines (with correct values):

```bash
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="27M9SrGA+p6VtX9gsA3qYMZJMEVhbCPd+MrajSVaakU="
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
DATABASE_URL="your-database-url"
```

### Step 3: Clear Browser Data

1. Open your browser's developer tools (F12)
2. Go to Application/Storage tab
3. Clear all cookies for `localhost:3000`
4. Or use an incognito/private window

### Step 4: Restart Development Server

1. Stop your dev server (Ctrl+C)
2. Start it again: `npm run dev`
3. Wait for it to fully start

### Step 5: Test Authentication

1. Go to `http://localhost:3000`
2. You should be redirected to `/login`
3. Click "Sign in with Google"
4. Complete the Google sign-in
5. You should be redirected back to the app

## Debugging Steps

### Check if Sessions are Being Created

You can check if sessions are being created in your database:

```bash
# If using SQLite
sqlite3 prisma/dev.db "SELECT * FROM Session;"

# Or use Prisma Studio
npm run db:studio
```

Look for entries in the `Session` table after signing in.

### Check Server Logs

Watch your terminal where `npm run dev` is running. Look for:
- Any errors related to NextAuth
- Database connection errors
- Session creation errors

### Check Browser Console

1. Open browser developer tools (F12)
2. Go to Console tab
3. Look for any JavaScript errors
4. Go to Network tab
5. Look for requests to `/api/auth/*`
6. Check if cookies are being set (look for `next-auth.session-token`)

### Verify Database Schema

Make sure your database has the NextAuth tables:

```bash
npx prisma db push
```

This will ensure all required tables (User, Account, Session, VerificationToken) exist.

## Common Issues

### Issue: "redirect_uri_mismatch"

**Solution:** Make sure your Google OAuth redirect URI in Google Cloud Console matches exactly:
- `http://localhost:3000/api/auth/callback/google`

### Issue: Session cookie not being set

**Possible causes:**
1. `NEXTAUTH_SECRET` is missing or incorrect
2. `NEXTAUTH_URL` doesn't match your actual URL
3. Browser blocking cookies (check privacy settings)

### Issue: Middleware blocking authenticated users

The middleware has been updated to check for session cookies. If you're still having issues, try temporarily disabling the middleware to see if that's the problem.

## Still Not Working?

If you've tried all the above steps and it's still not working:

1. Check the browser Network tab for the `/api/auth/callback/google` request
2. Look at the response - does it set cookies?
3. Check server logs for any errors
4. Verify the database has a Session entry after signing in

