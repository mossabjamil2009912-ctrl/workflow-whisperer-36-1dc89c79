# Bot business path: keep inverter size + single/three phase, then three choices

## What the customer will see in WhatsApp (business only)
1. Enters bill / monthly kWh / diesel, as today.
2. If the value fits the home range: goes straight to the three choices, as today.
3. Otherwise the bot asks for the inverter size (only sizes that cover the need), exactly as before.
4. If that size exists in both single and three phase, the bot asks "سنجل أو ثري"; if only one exists, it is picked automatically.
5. Then the bot sends three buttons: أقل استقلالية / موصى به / أكثر استقلالية, where "less" and "more" are the system directly before and after the recommended one in the same inverter family (falling back to the overall size list only when the family has no neighbour on that side).
6. Tapping a button sends that system's quote, as today.

## Steps
1. Read the live bot's current business branch and the three-choice helper.
2. Restore/keep the inverter-size and phase questions in the business branch; after the phase pick, compute the three choices with the "very next size" rule (same as the app).
3. Change the home-path three-choice helper to the same "very next size" rule so app and bot always match.
4. Save the workflow, then test with sample values (e.g. monthly 4,000 and 10,000 kWh) against the app's picks.
5. Mark the roadmap items done.

## Technical details
- n8n workflow `0XTNcO8mFT8cXsEB`, State Machine node: business path after `com_value` → existing inverter-size buttons → phase buttons → tier helper `tiersFrom(rec)` mirroring `QuoteBuilder.tsx` (same group by daily production, skip equal production, fallback to global size order) → buttons `tier_low` / `tier_rec` / `tier_high`.
- Update via the connector gateway (GET workflow, patch State Machine code, PUT).
