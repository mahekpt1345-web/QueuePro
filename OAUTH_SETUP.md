# OAuth Setup Guide for QueuePro

This guide explains how to obtain Google and Apple OAuth credentials and configure them for QueuePro.

---

## Table of Contents
1. [Google OAuth Setup](#google-oauth-setup)
2. [Apple OAuth Setup](#apple-oauth-setup)
3. [Environment Configuration](#environment-configuration)
4. [Testing OAuth Implementation](#testing-oauth-implementation)
5. [Troubleshooting](#troubleshooting)

---

## Google OAuth Setup

### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click on the project dropdown at the top and select "NEW PROJECT"
3. Enter project name: `QueuePro` (or your preference)
4. Click "CREATE"

### Step 2: Enable Google+ API

1. In the Cloud Console, go to **APIs & Services > Dashboard**
2. Click **+ ENABLE APIS AND SERVICES**
3. Search for "Google+ API"
4. Click on **Google+ API** from the results
5. Click **ENABLE**

### Step 3: Create OAuth 2.0 Credentials

1. Go to **APIs & Services > Credentials**
2. Click **+ CREATE CREDENTIALS** > **OAuth client ID**
3. If prompted, configure the **OAuth consent screen** first:
   - Select "External" for User Type
   - Click CREATE
   - Fill in the form:
     - App name: `QueuePro`
     - User support email: (your email)
     - Developer contact information: (your email)
   - Click SAVE AND CONTINUE
   - On Scopes, click ADD OR REMOVE SCOPES
   - Search for and select: `userinfo.email` and `userinfo.profile`
   - Click SAVE AND CONTINUE
   - Review and click BACK TO DASHBOARD
4. Back on Credentials, click **+ CREATE CREDENTIALS** > **OAuth client ID**
5. Select Application type: **Web application**
6. Under Authorized redirect URIs, click **+ ADD URI**
   - Add: `http://localhost:5000/auth/google/callback`
   - If production: `https://your-domain.com/auth/google/callback`
7. Click CREATE
8. Copy the **Client ID** and **Client Secret** from the popup

### Step 4: Add Google Credentials to .env

Update your `.env` file:

```
GOOGLE_CLIENT_ID=YOUR_CLIENT_ID_HERE
GOOGLE_CLIENT_SECRET=YOUR_CLIENT_SECRET_HERE
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback
```

---

## Apple OAuth Setup

### Prerequisites
- An Apple Developer Account ($99/year)
- A registered App ID with Sign in with Apple capability
- An App Group created for your app (optional)

### Step 1: Create an App ID (if not already done)

1. Go to [Apple Developer Portal](https://developer.apple.com/account/)
2. Click **Certificates, Identifiers & Profiles**
3. Click **Identifiers** in the sidebar
4. Click the **+** button to create a new identifier
5. Select **App IDs** and click Continue
6. Choose **App** (or App Clip) and click Continue
7. Fill in:
   - Description: `QueuePro`
   - Bundle ID: `com.yourcompany.queuepro` (use Explicit)
8. Under Capabilities, check **Sign in with Apple**
9. Click **Continue** and **Register**

### Step 2: Create a Service ID

1. In **Identifiers**, click the **+** button again
2. Select **Services IDs** and click Continue
3. Fill in:
   - Description: `QueuePro Web`
   - Identifier: `com.yourcompany.queuepro.web` (use Explicit)
4. Check **Sign in with Apple**
5. Click **Configure**
6. Select your App ID from the dropdown
7. Under **Website URLs**, click **+** to add:
   - **Domains and Subdomains**: `localhost` (for development)
   - **Return URLs**: `http://localhost:5000/auth/apple/callback`
   - For production: use your actual domain
8. Click **Save**, then **Continue**, then **Register**

### Step 3: Create a Private Key

1. In the sidebar, click **Keys**
2. Click the **+** button to create a new key
3. Name your key: `QueuePro Sign in with Apple`
4. Check **Sign in with Apple**
5. Click **Configure**
6. Select the **Service ID** you just created
7. Click **Save**, then **Continue**, then **Register**
8. **Download the Private Key** - Save it securely (you can only download once!)
9. Note the **Key ID** displayed on the screen

### Step 4: Get Your Team ID

1. In the Apple Developer Portal, click your account (top right)
2. Go to **Membership details**
3. Your **Team ID** is displayed there

### Step 5: Format the Private Key for .env

1. Open the private key file you downloaded (`.p8` file)
2. The content looks like:
   ```
   -----BEGIN PRIVATE KEY-----
   MIIEvQIBADANBgkqhkiG9w0BAQE...
   -----END PRIVATE KEY-----
   ```
3. Replace all newlines with `\n` to make it a single line for .env

### Step 6: Add Apple Credentials to .env

Update your `.env` file:

```
APPLE_TEAM_ID=YOUR_TEAM_ID
APPLE_KEY_ID=YOUR_KEY_ID
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BA...\n-----END PRIVATE KEY-----
APPLE_CALLBACK_URL=http://localhost:5000/auth/apple/callback
```

---

## Environment Configuration

### Complete .env Template

```env
# Server
PORT=5000
NODE_ENV=development

# Database
MONGODB_URI=mongodb+srv://user:password@cluster.mongodb.net/queuepro

# JWT
JWT_SECRET=your-secure-jwt-secret

# Sessions
SESSION_SECRET=your-secure-session-secret

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_CALLBACK_URL=http://localhost:5000/auth/google/callback

# Apple OAuth
APPLE_TEAM_ID=your-apple-team-id
APPLE_KEY_ID=your-apple-key-id
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
APPLE_CALLBACK_URL=http://localhost:5000/auth/apple/callback
```

---

## Testing OAuth Implementation

### Test Google Sign-Up

1. Start your server: `npm run dev`
2. Go to `http://localhost:5000/register`
3. Click "Sign up with Google" button
4. You should be redirected to Google login
5. After login, you should be redirected back to the login page
6. Check MongoDB to verify the user was created with `googleId` field

### Test Apple Sign-In

1. Go to `http://localhost:5000/register`
2. Click "Sign in with Apple" button
3. You should be redirected to Apple login
4. After login, you should be redirected back to the login page
5. Check MongoDB to verify the user was created with `appleId` field

### Manual Registration Test

1. Verify that manual registration still works
2. Fill the form with test data and submit
3. User should be created with `oauthProvider: 'manual'`

---

## Production Deployment

### Update Callback URLs

When deploying to production, update your .env with production URLs:

```env
# Google OAuth (Production)
GOOGLE_CALLBACK_URL=https://your-production-domain.com/auth/google/callback

# Apple OAuth (Production)
APPLE_CALLBACK_URL=https://your-production-domain.com/auth/apple/callback
```

### Register Production URLs with OAuth Providers

**Google:**
1. Go to Google Cloud Console > Credentials
2. Edit your OAuth 2.0 Client ID
3. Add production callback URL: `https://your-domain.com/auth/google/callback`
4. Add production origin: `https://your-domain.com`

**Apple:**
1. Go to Apple Developer Portal > Services IDs
2. Edit your Service ID
3. Under Website URLs, add production domain and callback URL

---

## Troubleshooting

### Google OAuth Issues

**"Invalid client" error:**
- Verify Client ID and Client Secret are correct
- Check callback URL matches exactly (http vs https, trailing slash, etc.)

**"Redirect URI mismatch" error:**
- Ensure callback URL in .env matches exactly what's registered in Google Console
- Include the full path: `/auth/google/callback`

**User not created after login:**
- Check MongoDB user collection for documents with `googleId` field
- Check server logs for errors
- Verify User model has `googleId` and `oauthProvider` fields

### Apple OAuth Issues

**"Invalid_client" error:**
- Verify Team ID, Key ID, and Private Key are correct
- Ensure Private Key is properly formatted with `\n` for newlines
- Check that the key hasn't expired

**"Callback URL mismatch" error:**
- Ensure callback URL matches exactly in Apple Developer Portal
- Protocol (http vs https) must match

**User not created after login:**
- Check that Service ID is properly configured
- Verify Private Key has proper formatting
- Check server logs for detailed error messages

### Phone Collection Issues

**User logged in but phone modal doesn't appear:**
- Verify phone is required in the User schema
- Check that session middleware is properly configured
- Ensure phone collection route is accessing correct user data

---

## Security Considerations

1. **Never commit .env to Git** - Add `.env` to `.gitignore`
2. **Use strong secrets** - Generate using: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
3. **Rotate keys periodically** - Regenerate secrets and OAuth credentials
4. **Use HTTPS in production** - OAuth callbacks must use HTTPS
5. **Validate all user input** - Always validate phone numbers and other fields
6. **Monitor failed OAuth attempts** - Log suspicious activity

---

## Related Documentation

- [Google OAuth 2.0 Documentation](https://developers.google.com/identity/protocols/oauth2)
- [Apple Sign in with Apple Documentation](https://developer.apple.com/sign-in-with-apple/documentation/)
- [Passport.js Documentation](http://www.passportjs.org/)
- [Express Session Documentation](https://github.com/expressjs/session)

---

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Review server logs: `npm run dev`
3. Check browser console for client-side errors
4. Verify all .env variables are set correctly
5. Test with curl or Postman if needed

