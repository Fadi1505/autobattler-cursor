# Lane Defense 3D QA Checklist

## Milestone Test Gates
- [x] Start a new run and auto-start of first wave works.
- [x] Manual `Start Wave` button works between waves.
- [x] Hero can move, jump, target lock, basic attack, and cast starter skill.
- [x] Hero receives XP/gold on enemy kills and levels up correctly.
- [x] Ability unlocks occur at levels 3, 6, and 9.
- [x] Town shop opens with `E` in trigger range and purchases apply correctly.
- [x] Consumables restore health/mana and equipment updates stats.
- [x] Inventory window toggles and item data is visible.
- [x] Enemy archetypes appear across waves (basic/tank/runner/ranged/support/elite/boss).
- [x] Boss waves occur at expected intervals and are survivable with build progression.
- [x] Defeat occurs when town core or hero health reaches zero.
- [x] Victory message appears at wave 15 completion.
- [x] Save/load persists profile values (highest wave, run totals, trait levels).
- [x] Frame pacing remains stable under max alive enemy cap.

## Regression Quick Pass
- [x] Input bindings still mapped correctly after restart.
- [x] No missing scene/script references on project open.
- [x] No runtime errors in output log during a full run.
