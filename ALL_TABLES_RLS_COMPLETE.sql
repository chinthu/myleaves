-- ============================================
-- COMPLETE RLS POLICIES FOR ALL TABLES
-- Leave Management System
-- ============================================

-- ============================================
-- USERS TABLE
-- ============================================

-- Drop existing policies
DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'users' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.users';
    END LOOP;
END $$;

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_select_all" ON public.users FOR SELECT TO authenticated USING (true);
CREATE POLICY "users_insert_all" ON public.users FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "users_delete_own" ON public.users FOR DELETE TO authenticated USING (auth.uid() = id);

-- ============================================
-- ORGANIZATIONS TABLE
-- ============================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'organizations' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.organizations';
    END LOOP;
END $$;

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "orgs_select_all" ON public.organizations FOR SELECT TO authenticated USING (true);
CREATE POLICY "orgs_insert_all" ON public.organizations FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "orgs_update_all" ON public.organizations FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

-- ============================================
-- GROUPS TABLE
-- ============================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'groups' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.groups';
    END LOOP;
END $$;

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "groups_select_all" ON public.groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "groups_insert_all" ON public.groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "groups_update_all" ON public.groups FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "groups_delete_all" ON public.groups FOR DELETE TO authenticated USING (true);

-- ============================================
-- GROUP_MEMBERS TABLE
-- ============================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'group_members' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.group_members';
    END LOOP;
END $$;

ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "group_members_select_all" ON public.group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "group_members_insert_all" ON public.group_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "group_members_delete_all" ON public.group_members FOR DELETE TO authenticated USING (true);

-- ============================================
-- LEAVES TABLE (if exists)
-- ============================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'leaves' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.leaves';
    END LOOP;
EXCEPTION
    WHEN undefined_table THEN
        NULL; -- Table doesn't exist, skip
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leaves') THEN
        ALTER TABLE public.leaves ENABLE ROW LEVEL SECURITY;
        
        EXECUTE 'CREATE POLICY "leaves_select_all" ON public.leaves FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "leaves_insert_all" ON public.leaves FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "leaves_update_all" ON public.leaves FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "leaves_delete_all" ON public.leaves FOR DELETE TO authenticated USING (true)';
    END IF;
END $$;

-- ============================================
-- LEAVE_REQUESTS TABLE (if exists)
-- ============================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'leave_requests' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.leave_requests';
    END LOOP;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'leave_requests') THEN
        ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;
        
        EXECUTE 'CREATE POLICY "leave_requests_select_all" ON public.leave_requests FOR SELECT TO authenticated USING (true)';
        EXECUTE 'CREATE POLICY "leave_requests_insert_all" ON public.leave_requests FOR INSERT TO authenticated WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "leave_requests_update_all" ON public.leave_requests FOR UPDATE TO authenticated USING (true) WITH CHECK (true)';
        EXECUTE 'CREATE POLICY "leave_requests_delete_all" ON public.leave_requests FOR DELETE TO authenticated USING (true)';
    END IF;
END $$;

-- ============================================
-- COMP_OFFS TABLE
-- ============================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'comp_offs' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.comp_offs';
    END LOOP;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'comp_offs') THEN
        ALTER TABLE public.comp_offs ENABLE ROW LEVEL SECURITY;
        
        -- Everyone can view comp_offs
        EXECUTE 'CREATE POLICY "comp_offs_select_all" ON public.comp_offs FOR SELECT TO authenticated USING (true)';
        
        -- Only HR, ADMIN, SUPER_ADMIN can insert comp_offs
        EXECUTE 'CREATE POLICY "comp_offs_insert_restricted" ON public.comp_offs FOR INSERT TO authenticated 
            WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN (''HR'', ''ADMIN'', ''SUPER_ADMIN''))';
        
        -- Only HR, ADMIN, SUPER_ADMIN can update comp_offs
        EXECUTE 'CREATE POLICY "comp_offs_update_restricted" ON public.comp_offs FOR UPDATE TO authenticated 
            USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN (''HR'', ''ADMIN'', ''SUPER_ADMIN''))
            WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN (''HR'', ''ADMIN'', ''SUPER_ADMIN''))';
        
        -- Only HR, ADMIN, SUPER_ADMIN can delete comp_offs
        EXECUTE 'CREATE POLICY "comp_offs_delete_restricted" ON public.comp_offs FOR DELETE TO authenticated 
            USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN (''HR'', ''ADMIN'', ''SUPER_ADMIN''))';
    END IF;
END $$;

-- ============================================
-- USER_COMP_OFFS TABLE
-- ============================================

DO $$ 
DECLARE
    r RECORD;
BEGIN
    FOR r IN (SELECT policyname FROM pg_policies WHERE tablename = 'user_comp_offs' AND schemaname = 'public')
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS ' || quote_ident(r.policyname) || ' ON public.user_comp_offs';
    END LOOP;
EXCEPTION
    WHEN undefined_table THEN
        NULL;
END $$;

DO $$
BEGIN
    IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = 'user_comp_offs') THEN
        ALTER TABLE public.user_comp_offs ENABLE ROW LEVEL SECURITY;
        
        -- Everyone can view their own or all user_comp_offs
        EXECUTE 'CREATE POLICY "user_comp_offs_select_all" ON public.user_comp_offs FOR SELECT TO authenticated USING (true)';
        
        -- Only HR, ADMIN, SUPER_ADMIN can insert user_comp_offs
        EXECUTE 'CREATE POLICY "user_comp_offs_insert_restricted" ON public.user_comp_offs FOR INSERT TO authenticated 
            WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN (''HR'', ''ADMIN'', ''SUPER_ADMIN''))';
        
        -- Only HR, ADMIN, SUPER_ADMIN can update user_comp_offs
        EXECUTE 'CREATE POLICY "user_comp_offs_update_restricted" ON public.user_comp_offs FOR UPDATE TO authenticated 
            USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN (''HR'', ''ADMIN'', ''SUPER_ADMIN''))
            WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) IN (''HR'', ''ADMIN'', ''SUPER_ADMIN''))';
        
        -- Only HR, ADMIN, SUPER_ADMIN can delete user_comp_offs
        EXECUTE 'CREATE POLICY "user_comp_offs_delete_restricted" ON public.user_comp_offs FOR DELETE TO authenticated 
            USING ((SELECT role FROM public.users WHERE id = auth.uid()) IN (''HR'', ''ADMIN'', ''SUPER_ADMIN''))';
    END IF;
END $$;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 
    schemaname,
    tablename,
    COUNT(*) as policy_count
FROM pg_policies 
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- Show all policies
SELECT 
    tablename,
    policyname,
    cmd as operation
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
