update public.tasks
set category = 'do'
where category::text = 'remember';

create type public.task_category_v2 as enum ('buy', 'do', 'blocker');

alter table public.tasks
  alter column category drop default;

alter table public.tasks
  alter column category type public.task_category_v2
  using (
    case
      when category::text = 'remember' then 'do'::public.task_category_v2
      else category::text::public.task_category_v2
    end
  );

drop type public.task_category;

alter type public.task_category_v2 rename to task_category;

alter table public.tasks
  alter column category set default 'do'::public.task_category;
