<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Bot items, prices and datasheet PDFs live only in `public.catalog_items`, edited from the dashboard and served to n8n via `/api/public/bot-catalog` — one source of truth so quotes and catalogs never diverge.
- PVsyst/SLD files are uploaded once per ready-made system (`preset_reports`, keyed by preset title) and sent by staff from `report_requests`; the bot only files a request, so customers never get an unreviewed report.
- The kWh price lives in `public.app_settings` (key `kwh_price`), edited from the quote screen and sent to n8n inside `/api/public/bot-catalog` — one value for bot and app.
- Quote system picks in `QuoteBuilder` are a literal port of the bot's resNearest/comInvOptions rules; change both together so they never disagree.
- Auto-add item rules live in `catalog_items.auto_rules` and are evaluated by `src/lib/auto-rules.ts` in QuoteBuilder and by its port `ACTES_AUTO_ADD` in the n8n State Machine (fed via `AUTO_RULES` in bot-catalog) — change both together so app and bot quotes match.
- Offline-first: every screen's data query must be wrapped in `offlineQuery` from `src/lib/offline-cache.ts` (it copies each result to the device and reads it back when the internet is missing), and the start page must stay in the service worker's `pages` cache via `saveShell()` in `src/lib/offline-shell.ts` — new screens have to follow the same pattern so the installed desktop app still opens and shows data with no internet.
- PVsyst reports are generated per request by `src/lib/pvsyst-pdf.ts` from numbers in `src/lib/pvsyst-calc.ts` (site weather from PVGIS for the customer's city, tilt and direction; Sanaa reference as fallback) and cached on the request's `file_path`.
- SLD diagrams are generated per request by `src/lib/sld-pdf.ts` from sizing in `src/lib/sld-calc.ts` and cached on the request's `file_path` — no uploaded per-system files needed.
