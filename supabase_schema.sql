-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- Organizations Table
create table public.organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Users Table (Extends Supabase Auth)
create table public.users (
  id uuid references auth.users not null primary key,
  email text not null,
  full_name text,
  role text not null check (role in ('SUPER_ADMIN', 'ADMIN', 'HR', 'TEAM_LEAD', 'USER', 'CEO')),
  organization_id uuid references public.organizations(id),
  designation text,
  balance_casual int default 0,
  balance_medical int default 0,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Groups Table
create table public.groups (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  organization_id uuid references public.organizations(id) not null,
  created_by uuid references public.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Group Members Table
create table public.group_members (
  id uuid default uuid_generate_v4() primary key,
  group_id uuid references public.groups(id) not null,
  user_id uuid references public.users(id) not null,
  unique(group_id, user_id)
);

-- Leaves Table
create table public.leaves (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.users(id) not null,
  type text not null check (type in ('CASUAL', 'MEDICAL', 'COMP_OFF')),
  start_date date not null,
  end_date date not null,
  is_half_day boolean default false,
  half_day_slot text check (half_day_slot in ('MORNING', 'AFTERNOON')),
  status text default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  assigned_group_id uuid references public.groups(id),
  approved_by uuid references public.users(id),
  reason text,
  rejection_reason text,
  days_count numeric not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Comp Offs Table (Created by HR)
create table public.comp_offs (
  id uuid default uuid_generate_v4() primary key,
  title text not null,
  description text,
  days numeric not null,
  created_by uuid references public.users(id),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- User Comp Offs (Mapping users to comp offs)
create table public.user_comp_offs (
  id uuid default uuid_generate_v4() primary key,
  comp_off_id uuid references public.comp_offs(id) not null,
  user_id uuid references public.users(id) not null,
  is_consumed boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Leave Settings Table (Organization-specific leave settings per year)
create table if not exists public.leave_settings (
  id uuid default uuid_generate_v4() primary key,
  organization_id uuid references public.organizations(id) on delete cascade not null,
  year integer not null,
  default_casual_leaves integer default 12,
  default_medical_leaves integer default 12,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(organization_id, year)
);

-- RLS Policies (Basic Setup - Refine as needed)
alter table public.organizations enable row level security;
alter table public.users enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.leaves enable row level security;
alter table public.comp_offs enable row level security;
alter table public.user_comp_offs enable row level security;
alter table public.leave_settings enable row level security;

-- Create a security definer function to get user role and org without RLS recursion
create or replace function public.get_user_role_org()
returns table(role text, organization_id uuid) 
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  select u.role, u.organization_id
  from public.users u
  where u.id = auth.uid();
end;
$$;

-- Policy: Users can view their own profile
create policy "Users can view own profile" on public.users
  for select using (auth.uid() = id);

-- Policy: HR/ADMIN/SUPER_ADMIN/CEO can view all users in their organization
drop policy if exists "users_select_org" on public.users;
create policy "users_select_org" on public.users
  for select to authenticated using (
    auth.uid() = id OR
    exists (
      select 1 from public.get_user_role_org() 
      where role in ('HR', 'ADMIN', 'SUPER_ADMIN', 'CEO')
    )
  );

-- Policy: HR/ADMIN/SUPER_ADMIN/CEO can update users in their organization
drop policy if exists "users_update_org" on public.users;
create policy "users_update_org" on public.users
  for update to authenticated using (
    auth.uid() = id OR
    exists (
      select 1 from public.get_user_role_org() ur
      where (
        (ur.role in ('HR', 'ADMIN', 'SUPER_ADMIN', 'CEO') AND ur.organization_id = users.organization_id) OR
        ur.role = 'SUPER_ADMIN'
      )
    )
  )
  with check (
    auth.uid() = id OR
    exists (
      select 1 from public.get_user_role_org() ur
      where (
        (ur.role in ('HR', 'ADMIN', 'SUPER_ADMIN', 'CEO') AND ur.organization_id = users.organization_id) OR
        ur.role = 'SUPER_ADMIN'
      )
    )
  );

-- Policy: Users can view their own leaves
create policy "Users can view own leaves" on public.leaves
  for select using (auth.uid() = user_id);

-- Policy: Users can insert their own leaves
create policy "Users can insert own leaves" on public.leaves
  for insert with check (auth.uid() = user_id);

-- Policy: Leave Settings - All authenticated users can view
drop policy if exists "leave_settings_select" on public.leave_settings;
create policy "leave_settings_select" on public.leave_settings
  for select to authenticated using (true);

-- Policy: Leave Settings - HR, ADMIN, SUPER_ADMIN, CEO can modify
drop policy if exists "leave_settings_modify" on public.leave_settings;
create policy "leave_settings_modify" on public.leave_settings
  for all to authenticated using (
    exists (
      select 1 from public.get_user_role_org() 
      where role in ('HR', 'ADMIN', 'SUPER_ADMIN', 'CEO')
    )
  );

-- TODO: Add more detailed policies for Approvers, HR, Admin
