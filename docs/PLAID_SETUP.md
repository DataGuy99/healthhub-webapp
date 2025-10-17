# Plaid Integration Setup Guide

## Overview
LifeDashHub uses Plaid to securely connect to bank accounts and sync transactions automatically.

**Cost**: $0.30/month per connected account (FREE in development/sandbox)

---

## Step 1: Create Plaid Account

1. Go to https://dashboard.plaid.com/signup
2. Sign up with your email
3. Verify your email address
4. Complete the onboarding questionnaire:
   - **Company Name**: LifeDashHub (or your name)
   - **Use Case**: Personal Finance Management
   - **Expected Volume**: < 100 users

---

## Step 2: Get API Credentials

1. Log in to https://dashboard.plaid.com
2. Navigate to **Team Settings** → **Keys**
3. Copy your credentials:
   - **client_id**: Your unique client identifier
   - **Sandbox secret**: For testing (free, fake data)
   - **Development secret**: For real bank connections (100 free accounts)

---

## Step 3: Configure Environment Variables

### For Local Development:

Create `.env` file in project root:

```bash
# Supabase (already configured)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Supabase Service Key (from Supabase dashboard → Settings → API)
SUPABASE_SERVICE_KEY=your-service-role-key

# Plaid Credentials
PLAID_CLIENT_ID=your_client_id_here
PLAID_SECRET=your_sandbox_secret_here
PLAID_ENV=sandbox
```

### For Netlify Deployment:

1. Go to Netlify dashboard → Your site → Site configuration → Environment variables
2. Add the following variables:
   - `SUPABASE_SERVICE_KEY`: Your Supabase service role key
   - `PLAID_CLIENT_ID`: Your Plaid client ID
   - `PLAID_SECRET`: Your Plaid secret (sandbox or development)
   - `PLAID_ENV`: `sandbox` or `development`

---

## Step 4: Run Database Migration

The Finance module requires new database tables. Run the migration:

### Option A: Supabase Dashboard (Recommended)

1. Go to https://supabase.com/dashboard
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy contents of `supabase/migrations/20251011_create_finance_tables.sql`
6. Paste and click **Run**

### Option B: Supabase CLI

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Link to your project
supabase link --project-ref your-project-ref

# Run migration
supabase db push
```

---

## Step 5: Test the Integration

### Sandbox Mode (Recommended First):

1. Set `PLAID_ENV=sandbox` in your `.env`
2. Start the app: `npm run dev`
3. Navigate to Finance tab
4. Click "Connect Bank Account"
5. Use Plaid's test credentials:
   - **Username**: `user_good`
   - **Password**: `pass_good`
   - **MFA Code**: `1234` (if prompted)
6. Select "First Platypus Bank"
7. Verify fake transactions appear

### Development Mode (Real Banks):

1. Set `PLAID_ENV=development`
2. Use `PLAID_SECRET` (development secret, not sandbox)
3. Connect your real bank account
4. Verify real transactions sync

---

## Step 6: Go to Production

When ready for production (costs $0.30/month per account):

1. In Plaid Dashboard → **Team Settings** → **Go to Production**
2. Fill out compliance questionnaire
3. Wait for approval (usually 1-2 business days)
4. Get your **Production secret**
5. Update environment variables:
   - `PLAID_ENV=production`
   - `PLAID_SECRET=your_production_secret`

---

## Troubleshooting

### "INVALID_CREDENTIALS" Error
- Check that `PLAID_CLIENT_ID` and `PLAID_SECRET` match in Plaid dashboard
- Ensure `PLAID_ENV` matches the secret type (sandbox/development/production)

### "ITEM_LOGIN_REQUIRED" Error
- Bank connection expired
- User needs to re-authenticate via Plaid Link

### Transactions Not Syncing
- Check Netlify Function logs for errors
- Verify `SUPABASE_SERVICE_KEY` is set correctly
- Ensure bank account is marked `is_active=true` in database

### CORS Errors
- Netlify Functions automatically handle CORS
- If testing locally, use Netlify CLI: `netlify dev`

---

## Cost Management

### Free Tier (Development):
- 100 connected accounts FREE
- Perfect for personal use

### Production Pricing:
- $0.30/month per connected account
- If you have 3 bank accounts: $0.90/month
- Much cheaper than Rocket Money ($6.59/month)

### To Minimize Costs:
- Only connect accounts you actively use
- Disconnect unused accounts: Set `is_active=false` in database

---

## Security Notes

- ✅ Plaid uses bank-level encryption (256-bit AES)
- ✅ Access tokens are encrypted in database
- ✅ Plaid never sees your bank password (OAuth-based)
- ✅ You can revoke access anytime via Plaid dashboard
- ❌ NEVER commit `.env` to Git
- ❌ NEVER expose `SUPABASE_SERVICE_KEY` to client-side code

---

## Next Steps

After Plaid is configured:
1. ✅ Database migration complete
2. ✅ Environment variables set
3. ⏳ Build Finance UI components
4. ⏳ Test transaction categorization
5. ⏳ Implement custom categories
6. ⏳ Add transaction itemization
7. ⏳ Create budget goals

---

## Support

- Plaid Docs: https://plaid.com/docs/
- Plaid Support: support@plaid.com
- LifeDashHub Issues: https://github.com/DataGuy99/healthhub-webapp/issues
