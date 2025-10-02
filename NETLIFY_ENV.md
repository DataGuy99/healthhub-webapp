# Netlify Environment Variables

Add these environment variables in your Netlify dashboard:

**Site settings** → **Environment variables** → **Add a variable**

## Required Variables

```
VITE_SUPABASE_URL=https://clxocppshubwtbloefsv.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNseG9jcHBzaHVid3RibG9lZnN2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTkzNzUzODAsImV4cCI6MjA3NDk1MTM4MH0.2zrURI4_gachSV8v-v9qWLxIS3tCk0ylmzAwL0-o2bA
```

## After Adding Variables

1. Click **Save**
2. Go to **Deploys** → **Trigger deploy** → **Deploy site**
3. Wait for build to complete (~2 minutes)
4. Visit your site URL

Your Netlify site will now have access to Supabase!
