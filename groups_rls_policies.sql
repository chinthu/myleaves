-- RLS Policies for Groups Table
-- Run this in Supabase SQL Editor to allow group management

-- Policy: Admins and HR can view all groups in their organization
create policy "Admins and HR can view groups" on public.groups
  for select using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.role in ('SUPER_ADMIN', 'ADMIN', 'HR')
    )
  );

-- Policy: Admins and HR can create groups
create policy "Admins and HR can create groups" on public.groups
  for insert with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.role in ('SUPER_ADMIN', 'ADMIN', 'HR')
    )
  );

-- Policy: Admins and HR can update groups
create policy "Admins and HR can update groups" on public.groups
  for update using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.role in ('SUPER_ADMIN', 'ADMIN', 'HR')
    )
  );

-- Policy: Admins and HR can delete groups
create policy "Admins and HR can delete groups" on public.groups
  for delete using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.role in ('SUPER_ADMIN', 'ADMIN', 'HR')
    )
  );

-- Policy: Regular users can view groups they are members of
create policy "Users can view their groups" on public.groups
  for select using (
    exists (
      select 1 from public.group_members
      where group_members.group_id = groups.id
      and group_members.user_id = auth.uid()
    )
  );

-- RLS Policies for Group Members Table

-- Policy: Admins and HR can view all group members
create policy "Admins and HR can view members" on public.group_members
  for select using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.role in ('SUPER_ADMIN', 'ADMIN', 'HR')
    )
  );

-- Policy: Admins and HR can add group members
create policy "Admins and HR can add members" on public.group_members
  for insert with check (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.role in ('SUPER_ADMIN', 'ADMIN', 'HR')
    )
  );

-- Policy: Admins and HR can remove group members
create policy "Admins and HR can remove members" on public.group_members
  for delete using (
    exists (
      select 1 from public.users
      where users.id = auth.uid()
      and users.role in ('SUPER_ADMIN', 'ADMIN', 'HR')
    )
  );

-- Policy: Users can view their own group memberships
create policy "Users can view own memberships" on public.group_members
  for select using (auth.uid() = user_id);
