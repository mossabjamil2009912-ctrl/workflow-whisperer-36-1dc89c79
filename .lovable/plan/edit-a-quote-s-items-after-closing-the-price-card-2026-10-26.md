# Edit a quote's items after closing the price card

## Goal
Whether a quote comes from a ready-made system or from the home/business calculation, closing the price card (X) shows its items ready to edit: change quantities, swap an item for another type, add or delete items. Changes apply only to this quote copy. The ready-made system and the item list stay as they are.

## What the user will see
- After closing the price card, the screen scrolls to "Selected items" (on phones too) with a note: "You can edit this quote before saving or sending".
- Each selected item gets:
  - minus / number / plus buttons for quantity
  - a "Change" button that opens items from the same section (e.g. other batteries) and replaces it, keeping the quantity
  - a delete button (already there)
- "Add item" opens the item sections to add any item or a custom one (already there, now reachable from the same spot).
- Optional per-quote price change for an item, only for this quote.
- "Create quote" refreshes the price card with the edits; save/send use the edited version.

## Already true
- Loading a ready-made system copies its items into the current quote, so edits never change the system or the item list. No change needed there.

## Steps
1. Add quantity controls, "Change" and an optional price field to each selected item row.
2. Add a "Change item" picker filtered to the same section.
3. When the price card closes, scroll to the selected items and show the edit note.
4. Check that a ready-made system loads, edit it, and reopen it: it shows the original items again.

## Technical details
- `QuoteBuilder` only: per-line `setQty`, `swapLine(oldKey, row)` (keeps qty, takes name/specs/price from catalog), local `setPrice`; a ref plus `scrollIntoView` on preview close. No schema or bot changes.
