# Data snapshot (2026-10-31)

A full copy of the app's data from the date above. It is not updated automatically. Keep this repository **private**: it contains customer phone numbers and conversations.

- `*.csv`: one file per public table, with a header row.
- `files/<bucket>/...`: uploaded storage files (the `crm-attachments` bucket).

## Restore into a fresh database (schema already applied via `drizzle/` migrations)

Load the tables in this order, so linked rows always find their customer:

```sql
\copy public.app_settings     FROM 'data/app_settings.csv'     CSV HEADER
\copy public.catalog_items    FROM 'data/catalog_items.csv'    CSV HEADER
\copy public.customers        FROM 'data/customers.csv'        CSV HEADER
\copy public.messages         FROM 'data/messages.csv'         CSV HEADER
\copy public.orders           FROM 'data/orders.csv'           CSV HEADER
\copy public.quotes           FROM 'data/quotes.csv'           CSV HEADER
\copy public.report_requests  FROM 'data/report_requests.csv'  CSV HEADER
\copy public.support_tickets  FROM 'data/support_tickets.csv'  CSV HEADER
\copy public.preset_reports   FROM 'data/preset_reports.csv'   CSV HEADER
\copy public.bot_button_locks FROM 'data/bot_button_locks.csv' CSV HEADER
```

Then upload `files/crm-attachments/*` into a storage bucket named `crm-attachments`, keeping the same paths.
