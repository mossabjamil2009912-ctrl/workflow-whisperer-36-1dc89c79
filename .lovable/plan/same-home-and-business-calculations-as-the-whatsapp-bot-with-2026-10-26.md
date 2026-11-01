# Same home and business calculations as the WhatsApp bot, with one editable kWh price

## Goal
- The app picks exactly the same system as the WhatsApp bot for the same input (home bill, business bill, monthly kWh, diesel).
- The kWh price becomes 290 riyals everywhere.
- A new field in the app lets staff change the kWh price. Changing it there changes it in the bot and in the app at the same moment.

## What the user will see
- Under "Item list" (or a small settings box), a field "kWh price (riyals)" set to 290 with a Save button.
- In "Create quote", home and business answers match the bot exactly. When two systems are equally close, both appear so staff can pick, like the bot's buttons.

## Steps
1. Store the kWh price in the app's database (one setting, starting at 290), editable only by signed-in staff.
2. Add the price field and Save button in the app.
3. Send the price to the bot along with the item list it already loads, so the bot uses it instead of its fixed 250.
4. Update the bot's flow: read the price from the app, falling back to 290 if the app is unreachable.
5. Rebuild the app's home and business selection as a direct copy of the bot's rules: same home table numbers ("range"), same tie handling, same "above largest home system moves to business" rule, same business rule (smallest covering system, small business treated as home), diesel = litres / 0.27.
6. Tests: run many bills, kWh and diesel values through both the app and a copy of the bot's rules and check they match. Also check that changing the price changes the result (for example 50,000 riyals at 290 and at 250).
7. Check in the app, then publish and update the bot together so they never disagree.

## Technical details
- New `app_settings` table (key/value) with RLS and grants; `kwh_price` row seeded to 290 in the migration.
- `/api/public/bot-catalog` response gains `settings.kwh_price`; n8n State Machine sets `KWH_PRICE` from the existing ACTES live catalog sync.
- `QuoteBuilder` loads `kwh_price` from settings; selection functions take price as a parameter. Port `resNearest`, `lookupByBill`, `RES_TABLE.range` and the commercial rule from the bot JSON verbatim.
- Update the kWh price memory from 250 to "editable, default 290".
