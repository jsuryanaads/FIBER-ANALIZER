alter table public.customers
  add column if not exists package_name text;

comment on column public.customers.package_name is 'Customer service package or bandwidth label used by the application.';
