# Lane Defense 3D (Hybrid Prototype)

A 3D lane-defense game built in Godot 4.5 with hybrid controls:
- Direct third-person movement and aiming
- Target-based abilities for reliable combat
- Town shop economy, towers, and wave-defense progression
- Meta-progression traits that persist across runs

## Controls

| Action | Input |
|--------|-------|
| Move | **W A S D** |
| Jump | **Space** |
| Basic attack | **Left mouse button** |
| Lock target | **Tab** |
| Skill 1 — Arc Bolt | **Q** (level 1) |
| Skill 2 — Flame Wave | **R** (unlocks at level 3) |
| Skill 3 — Chain Blast | **F** (unlocks at level 6) |
| Skill 4 — Nova Guard | **G** (unlocks at level 9) |
| Interact (shop) | **E** |
| Inventory | **I** |
| Build / upgrade tower | **T** (when near a tower slot) |
| Pause | **Esc** |

## Current Systems

- Wave spawning with weighted enemy archetypes (basic, tank, runner, ranged, support, elite)
- Boss waves every 5 waves: exactly one boss spawns alongside a smaller pack of adds. Boss has Normal / Enraged / Desperate phases with melee, charge, and AoE stomp shockwave
- XP, gold, level-ups, and ability unlocks at levels 3 / 6 / 9 with on-screen unlock popup
- Town shop for consumables and equipment that modifies hero stats
- Tower placement along the lane (archer, slow, cannon) with gold-cost upgrades
- Meta-progression UI for permanent stat traits (max health, max mana, attack damage)
- Settings UI for audio bus volumes
- Save/load profile (highest wave, run totals, meta traits, audio settings, keybinds)
- Pause menu and run-over screen with restart

## Key Scenes

- `res://scenes/world/GameWorld.tscn` (main scene)
- `res://scenes/world/TownHub.tscn`
- `res://scenes/world/LaneMap.tscn`
- `res://scenes/world/Tower.tscn`
- `res://scenes/player/Hero.tscn`
- `res://scenes/enemies/Enemy.tscn`, `BossEnemy.tscn`
- `res://scenes/ui/WorldUI.tscn` (HUD + child panels)

## Autoloads

- `GameState` — run state (level, XP, gold, hero stats, inventory, equipment, abilities)
- `WaveDirector` — wave/spawn pacing and signals
- `SaveSystem` — JSON save/load + InputMap keybind apply
- `ProfileData` — persisted profile (wave records, traits, settings, keybinds)
- `MetaProgression` — permanent trait levels and starting bonuses
- `BalanceTables` — enemy stats, weights, budgets, shop catalog

## QA and Export

- QA checklist: `docs/QA_CHECKLIST.md`
- Windows export preset: `export_presets.cfg`
