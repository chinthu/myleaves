# Row Level Security (RLS) Setup Guide

## Problem
When trying to create users or perform other admin operations, you're getting:
```
new row violates row-level security policy for table "users"
```

This happens because RLS is enabled but proper policies aren't configured.

## Solution

Run the SQL files in your Supabase SQL Editor in this order:

### 1. Users Table RLS Policies
**File:** `users_rls_policies.sql`

**Run this first** - This fixes the immediate issue with creating users.

**What it does:**
- ✅ Allows users to view/update their own profile
- ✅ Allows ADMIN/HR/SUPER_ADMIN to view all users in their organization
- ✅ Allows ADMIN/HR/SUPER_ADMIN to INSERT new users
- ✅ Allows ADMIN/HR/SUPER_ADMIN to UPDATE users in their org
- ✅ Allows SUPER_ADMIN to DELETE users

### 2. Complete RLS Policies (All Tables)
**File:** `complete_rls_policies.sql`

**Run this next** - This prevents future RLS issues on other tables.

**What it covers:**
- Organizations table
- Leave Requests table
- Leave Balances table
- Groups table (already done in `groups_rls_policies.sql`)

## How to Apply

1. **Open Supabase Dashboard**
   - Go to your project: https://app.supabase.com

2. **Navigate to SQL Editor**
   - Click "SQL Editor" in the left sidebar

3. **Run users_rls_policies.sql**
   - Copy all content from `users_rls_policies.sql`
   - Paste into SQL Editor
   - Click "Run"

4. **Run complete_rls_policies.sql**
   - Copy all content from `complete_rls_policies.sql`
   - Paste into SQL Editor
   - Click "Run"

5. **Test**
   - Go to Users Management in your app
   - Try creating a new user
   - It should work now!

## Verification

After running the policies, you can verify them in Supabase:

1. Go to **Database** → **Tables**
2. Click on `users` table
3. Click **"Policies"** tab
4. You should see all 6 policies listed

## Key Policies Explained

### For Regular Users:
- Can view their own profile
- Can update their own profile
- Can create/view/update their own leave requests
- Can view their own leave balance

### For Admins/HR:
- Can view all users in their organization
- Can create new users
- Can update user profiles
- Can manage leave requests
- Can manage leave balances

### For Super Admins:
- All Admin/HR permissions plus:
- Can delete users
- Can manage organization settings

## Troubleshooting

If you still get RLS errors:

1. **Check your user's role:**
   ```sql
   SELECT id, email, role FROM public.users WHERE id = auth.uid();
   ```

2. **Check if RLS is enabled:**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public';
   ```

3. **View current policies:**
   ```sql
   SELECT tablename, policyname, cmd, qual 
   FROM pg_policies 
   WHERE schemaname = 'public' AND tablename = 'users';
   ```

## Need to Disable RLS Temporarily?

**⚠️ NOT RECOMMENDED for production, but for testing:**

```sql
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
```

**Re-enable it immediately after testing:**

```sql
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
```
