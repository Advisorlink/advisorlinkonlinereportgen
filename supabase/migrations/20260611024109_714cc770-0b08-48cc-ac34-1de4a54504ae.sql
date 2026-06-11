drop trigger if exists pipeline_deals_mark_sheet_lead_deleted on public.pipeline_deals;
create trigger pipeline_deals_mark_sheet_lead_deleted
before delete on public.pipeline_deals
for each row execute function public.mark_sheet_lead_deleted();

drop trigger if exists pipeline_deals_mark_excluded_on_stage on public.pipeline_deals;
create trigger pipeline_deals_mark_excluded_on_stage
after update of stage_id on public.pipeline_deals
for each row execute function public.mark_sheet_lead_excluded_on_stage_change();

drop trigger if exists deal_tasks_move_to_tasks_due on public.deal_tasks;
create trigger deal_tasks_move_to_tasks_due
after insert on public.deal_tasks
for each row execute function public.move_deal_to_tasks_due();