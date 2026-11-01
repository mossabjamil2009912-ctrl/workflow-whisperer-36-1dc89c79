# Three choices after entering a value: less independence / recommended / more independence

## Goal
After a customer or staff member enters a bill, monthly kWh or diesel amount (home or business), in the app or in the WhatsApp bot, they see three choices:
- **أقل استقلالية**: the system one size smaller than the right one
- **موصى به**: the right system (same as today)
- **أكثر استقلالية**: the system one size larger than the right one

## What the user will see
- **App (Create quote):** after entering the value, three buttons appear. Tapping one opens that system's price card, like today.
- **WhatsApp bot:** after the value, the bot replies with three buttons with the same names. Tapping one sends that system's quote.

## Rules
- Systems are ordered by size: all home systems from smallest to largest, then business systems from smallest to largest. "Smaller" and "larger" mean the neighbour in this one list, so it can cross from home to business and back.
- If the right system is the smallest, "less independence" is hidden. If it is the largest, "more independence" is hidden.
- If two systems are equally close (a tie, which today shows both), "recommended" is the first one, "less" is the one before both, and "more" is the one after both.
- Ready-made systems are not affected (they open directly as today).
- Prices, names and specs still come from the item list.

## Steps
1. Add one shared "neighbours" rule in the app that returns smaller / recommended / larger for any input.
2. Replace the current result in Create quote with the three buttons.
3. Update the live bot in n8n: after the value, send the three buttons; each button leads to the same quote message the bot already sends today.
4. Tests: check the three picks for sample bills, kWh and diesel values, plus the smallest/largest edges and a tie.
5. Check in the app, then publish and update the bot together.

## Technical details
- `QuoteBuilder.tsx`: new `tieredOptions(method, value, price)` built on `optionsForResBill`/`optionsForCom`, using a single ordered list of `BOT_PRESETS` (res by range, then com by daily production).
- n8n State Machine: after `res_value`/`com_value`, compute the same ordered list from RES_TABLE + commercial options and send an interactive 3-button message (ids `tier_low`, `tier_rec`, `tier_high`); existing per-system quote send is reused.
