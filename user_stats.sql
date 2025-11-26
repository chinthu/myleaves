-- Function to get user leave statistics and comp-off balance
create or replace function public.get_user_leave_stats(
  p_organization_id uuid,
  p_year integer
)
returns table (
  id uuid,
  full_name text,
  email text,
  balance_casual int,
  balance_medical int,
  organization_id uuid,
  total_applied bigint,
  pending bigint,
  approved bigint,
  rejected bigint,
  cancelled bigint,
  casual_leaves_taken numeric,
  medical_leaves_taken numeric,
  comp_off_leaves_taken numeric,
  total_days_taken numeric,
  remaining_comp_offs numeric
)
language plpgsql
security definer
as $$
declare
  v_start_date date := (p_year || '-01-01')::date;
  v_end_date date := (p_year || '-12-31')::date;
begin
  return query
  with user_leaves as (
    select 
      l.user_id,
      count(*) as total_applied,
      count(*) filter (where l.status = 'PENDING') as pending,
      count(*) filter (where l.status = 'APPROVED') as approved,
      count(*) filter (where l.status = 'REJECTED') as rejected,
      count(*) filter (where l.status = 'CANCELLED') as cancelled,
      coalesce(sum(l.days_count) filter (where l.status = 'APPROVED' and l.type = 'CASUAL'), 0) as casual_leaves_taken,
      coalesce(sum(l.days_count) filter (where l.status = 'APPROVED' and l.type = 'MEDICAL'), 0) as medical_leaves_taken,
      coalesce(sum(l.days_count) filter (where l.status = 'APPROVED' and l.type = 'COMP_OFF'), 0) as comp_off_leaves_taken,
      coalesce(sum(l.days_count) filter (where l.status = 'APPROVED'), 0) as total_days_taken
    from public.leaves l
    where l.start_date >= v_start_date
      and l.start_date <= v_end_date
    group by l.user_id
  ),
  user_comp_offs_balance as (
    select 
      uco.user_id,
      coalesce(sum(co.days), 0) as balance
    from public.user_comp_offs uco
    join public.comp_offs co on uco.comp_off_id = co.id
    where uco.is_consumed = false
    group by uco.user_id
  )
  select 
    u.id,
    u.full_name,
    u.email,
    u.balance_casual,
    u.balance_medical,
    u.organization_id,
    coalesce(ul.total_applied, 0) as total_applied,
    coalesce(ul.pending, 0) as pending,
    coalesce(ul.approved, 0) as approved,
    coalesce(ul.rejected, 0) as rejected,
    coalesce(ul.cancelled, 0) as cancelled,
    coalesce(ul.casual_leaves_taken, 0) as casual_leaves_taken,
    coalesce(ul.medical_leaves_taken, 0) as medical_leaves_taken,
    coalesce(ul.comp_off_leaves_taken, 0) as comp_off_leaves_taken,
    coalesce(ul.total_days_taken, 0) as total_days_taken,
    coalesce(ucb.balance, 0) as remaining_comp_offs
  from public.users u
  left join user_leaves ul on u.id = ul.user_id
  left join user_comp_offs_balance ucb on u.id = ucb.user_id
  where u.organization_id = p_organization_id;
end;
$$;
