-- Function to process year-end leaves and balances
create or replace function public.process_year_end(
  p_organization_id uuid,
  p_year integer,
  p_carry_forward_enabled boolean
)
returns void
language plpgsql
security definer
as $$
declare
  v_previous_year integer := p_year - 1;
  v_start_date date := (v_previous_year || '-01-01')::date;
  v_end_date date := (v_previous_year || '-12-31')::date;
  v_user record;
  v_leave_stats record;
  v_default_casual integer;
  v_default_medical integer;
  v_new_casual_balance integer;
begin
  -- Get default settings for the organization
  select default_casual_leaves, default_medical_leaves
  into v_default_casual, v_default_medical
  from public.leave_settings
  where organization_id = p_organization_id
  limit 1;

  -- Fallback if settings not found
  if v_default_casual is null then v_default_casual := 12; end if;
  if v_default_medical is null then v_default_medical := 12; end if;

  -- Loop through all users in the organization
  for v_user in (select * from public.users where organization_id = p_organization_id) loop
    
    -- Calculate leave statistics for the previous year
    select 
      count(*) as total_applied,
      count(*) filter (where status = 'APPROVED') as total_approved,
      count(*) filter (where status = 'PENDING') as total_pending,
      count(*) filter (where status = 'REJECTED') as total_rejected,
      count(*) filter (where status = 'CANCELLED') as total_cancelled,
      coalesce(sum(days_count) filter (where status = 'APPROVED' and type = 'CASUAL'), 0) as casual_taken,
      coalesce(sum(days_count) filter (where status = 'APPROVED' and type = 'MEDICAL'), 0) as medical_taken,
      coalesce(sum(days_count) filter (where status = 'APPROVED' and type = 'COMP_OFF'), 0) as comp_off_taken,
      coalesce(sum(days_count) filter (where status = 'APPROVED'), 0) as total_days_taken
    into v_leave_stats
    from public.leaves
    where user_id = v_user.id
      and start_date >= v_start_date
      and start_date <= v_end_date;

    -- Create archive record
    insert into public.leave_archives (
      user_id,
      organization_id,
      year,
      total_leaves_applied,
      total_leaves_approved,
      total_leaves_pending,
      total_leaves_rejected,
      total_leaves_cancelled,
      casual_leaves_taken,
      medical_leaves_taken,
      comp_off_leaves_taken,
      total_days_taken,
      balance_casual_at_year_end,
      balance_medical_at_year_end,
      balance_compoff_at_year_end,
      carry_forward_casual,
      carry_forward_medical
    ) values (
      v_user.id,
      p_organization_id,
      v_previous_year,
      v_leave_stats.total_applied,
      v_leave_stats.total_approved,
      v_leave_stats.total_pending,
      v_leave_stats.total_rejected,
      v_leave_stats.total_cancelled,
      v_leave_stats.casual_taken,
      v_leave_stats.medical_taken,
      v_leave_stats.comp_off_taken,
      v_leave_stats.total_days_taken,
      coalesce(v_user.balance_casual, 0),
      coalesce(v_user.balance_medical, 0),
      coalesce(v_user.balance_compoff, 0),
      case when p_carry_forward_enabled then coalesce(v_user.balance_casual, 0) else 0 end,
      0 -- Medical leaves never carry forward
    )
    on conflict (user_id, organization_id, year) do update set
      total_leaves_applied = excluded.total_leaves_applied,
      total_leaves_approved = excluded.total_leaves_approved,
      total_leaves_pending = excluded.total_leaves_pending,
      total_leaves_rejected = excluded.total_leaves_rejected,
      total_leaves_cancelled = excluded.total_leaves_cancelled,
      casual_leaves_taken = excluded.casual_leaves_taken,
      medical_leaves_taken = excluded.medical_leaves_taken,
      comp_off_leaves_taken = excluded.comp_off_leaves_taken,
      total_days_taken = excluded.total_days_taken,
      balance_casual_at_year_end = excluded.balance_casual_at_year_end,
      balance_medical_at_year_end = excluded.balance_medical_at_year_end,
      balance_compoff_at_year_end = excluded.balance_compoff_at_year_end,
      carry_forward_casual = excluded.carry_forward_casual;

    -- Archive leaves
    update public.leaves
    set is_archived = true, archived_at = now()
    where user_id = v_user.id
      and start_date >= v_start_date
      and start_date <= v_end_date;

    -- Calculate new balances
    v_new_casual_balance := v_default_casual;
    if p_carry_forward_enabled then
      v_new_casual_balance := v_new_casual_balance + greatest(0, coalesce(v_user.balance_casual, 0));
    end if;

    -- Update user balances
    update public.users
    set 
      balance_casual = v_new_casual_balance,
      balance_medical = v_default_medical,
      balance_compoff = 0 -- Reset comp off
    where id = v_user.id;

  end loop;

  -- Update settings to mark year end as processed
  update public.leave_settings
  set 
    year_end_processed = true,
    year_end_processed_at = now()
  where organization_id = p_organization_id;

end;
$$;
