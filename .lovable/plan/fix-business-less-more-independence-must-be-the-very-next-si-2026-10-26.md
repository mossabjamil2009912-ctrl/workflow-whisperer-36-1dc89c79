# Fix: business "less / more independence" must be the very next size, not several steps away

## What is wrong (confirmed in the code)
For business values the right-system step returns several systems at once (one per inverter size and phase that can cover the need, e.g. 30 kW, 40 kW, 50 kW...). The three-choice rule then takes the system *before the smallest* of all of them and *after the largest* of all of them. So "more independence" jumps past every inverter size in the list, and "less" can also skip — exactly what you noticed. Home values mostly return a single system, so they are not affected the same way.

## What changes
- **موصى به** stays the right system (the first one, as today).
- **أقل استقلالية** = the system directly before the recommended one in the size list.
- **أكثر استقلالية** = the system directly after the recommended one.
- Neighbours are only taken from the **same inverter family/phase** as the recommended system when one exists on that side (so a 3-phase 50 kW recommendation steps to the next 3-phase system, not to a different inverter several sizes up). If there is no smaller/larger system in that family, fall back to the next one in the overall list (home → business crossing still works).
- Systems with identical production to the recommended one are skipped, so "less"/"more" always actually differ.
- Same fix applied to the live bot so both give identical answers.

## Steps
1. Change the three-choice rule to measure neighbours from the recommended system only.
2. Add tests: for several business values (bill, monthly kWh, diesel) the "less" system is the closest smaller one and "more" the closest larger one — no other system lies between them and the recommended.
3. Check a few values on screen (e.g. monthly 4,000 / 10,000 / 20,000 kWh) and show you the three picks.
4. Update the bot's matching rule in n8n the same way.

## Also: pick inverter size and single/three phase for business (like the bot)
- For business values that need a large system, after entering the value the app shows the inverter sizes that can cover the need (same list the bot shows), e.g. 30 / 40 / 50 kW.
- After picking a size, if that size comes in both single phase and three phase, the app asks "سنجل أو ثري"; if only one exists it is chosen automatically.
- Then the three choices (less / recommended / more) appear for that size and phase.
- Small business values that fall in the home range keep going straight to the three choices, as today.
- Add tests: the size list matches the bot's list for sample values; the phase question only appears when both exist.
- Add this task to the roadmap.

## Technical details
- `QuoteBuilder.tsx` `tiersFrom`: use `idx = SIZE_ORDER.indexOf(opts[0])` instead of min/max over all `opts`; search within same `group` sorted by `dailyProduction` first, then global `SIZE_ORDER`; skip equal production.
- Tie case (home): keep "rec" = first tied system; low/high skip the other tied systems.
- n8n State Machine tier helper mirrors this.
