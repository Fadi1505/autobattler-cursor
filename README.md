# Lane Defense 3D (Hybrid Prototype)

A 3D lane-defense game built in Godot with hybrid controls:
- Direct third-person movement
- Target-based abilities for reliable combat
- Town shop economy and wave-defense progression

## Controls

| Action | Input |
|--------|--------|
| Move | **W** forward, **S** back, **A** left, **D** right |
| Jump | **Space** |
| Basic attack | **Left mouse button** |
| Cast skill (Arc Bolt) | **Q** |
| Lock target | **Tab** |
| Interact (e.g. shop) | **E** |
| Inventory | **I** |
| Pause | **Esc** |

## Current Systems
- Wave spawning with weighted enemy archetypes and boss intervals
- XP/gold rewards, leveling, and ability unlock thresholds
- Town shop for consumables and equipment upgrades
- Save/load profile data for persistent progression
- HUD for core run state and onboarding controls

## Key Scenes
- `res://scenes/world/GameWorld.tscn` (main scene)
- `res://scenes/world/TownHub.tscn`
- `res://scenes/world/LaneMap.tscn`

## QA and Export
- QA checklist: `docs/QA_CHECKLIST.md`
- Windows export preset: `export_presets.cfg`
