extends Node

signal gold_changed(new_value: int)
signal xp_changed(current_xp: int, required_xp: int)
signal level_changed(new_level: int)
signal hero_stats_changed(stats: Dictionary)
signal inventory_changed(items: Array)
signal wave_failed()
# Emitted from GameWorld when player wins (e.g. wave 15 cleared).
# warning-ignore:unused_signal
signal run_won()

const BASE_REQUIRED_XP := 100

var level: int = 1
var xp: int = 0
var gold: int = 0
var wave_index: int = 0

var hero_stats := {
	"max_health": 100.0,
	"health": 100.0,
	"max_mana": 60.0,
	"mana": 60.0,
	"attack_damage": 12.0,
	"attack_speed": 1.0,
	"move_speed": 7.0,
	"ability_power": 8.0
}

var inventory: Array[Dictionary] = []
var equipment := {
	"weapon": {},
	"armor": {},
	"trinket": {}
}
var unlocked_abilities: Array[String] = ["arc_bolt"]

func _ready() -> void:
	reset_run()

func reset_run() -> void:
	level = 1
	xp = 0
	gold = 0
	wave_index = 0
	inventory.clear()
	equipment = {"weapon": {}, "armor": {}, "trinket": {}}
	unlocked_abilities = ["arc_bolt"]
	hero_stats = {
		"max_health": 100.0 + MetaProgression.get_starting_bonus("max_health"),
		"health": 100.0 + MetaProgression.get_starting_bonus("max_health"),
		"max_mana": 60.0 + MetaProgression.get_starting_bonus("max_mana"),
		"mana": 60.0 + MetaProgression.get_starting_bonus("max_mana"),
		"attack_damage": 12.0 + MetaProgression.get_starting_bonus("attack_damage"),
		"attack_speed": 1.0,
		"move_speed": 7.0,
		"ability_power": 8.0
	}
	_emit_all()

func add_xp(amount: int) -> void:
	xp += max(0, amount)
	var needed := required_xp_for_level(level)
	while xp >= needed:
		xp -= needed
		level += 1
		_apply_level_growth()
		_try_unlock_ability()
		level_changed.emit(level)
		needed = required_xp_for_level(level)
	xp_changed.emit(xp, needed)

func add_gold(amount: int) -> void:
	gold += max(0, amount)
	gold_changed.emit(gold)

func spend_gold(amount: int) -> bool:
	if amount > gold:
		return false
	gold -= amount
	gold_changed.emit(gold)
	return true

func apply_damage(amount: float) -> void:
	hero_stats["health"] = maxf(0.0, float(hero_stats["health"]) - amount)
	hero_stats_changed.emit(hero_stats.duplicate(true))
	if float(hero_stats["health"]) <= 0.0:
		wave_failed.emit()

func heal(amount: float) -> void:
	hero_stats["health"] = minf(float(hero_stats["max_health"]), float(hero_stats["health"]) + amount)
	hero_stats_changed.emit(hero_stats.duplicate(true))

func restore_mana(amount: float) -> void:
	hero_stats["mana"] = minf(float(hero_stats["max_mana"]), float(hero_stats["mana"]) + amount)
	hero_stats_changed.emit(hero_stats.duplicate(true))

func spend_mana(amount: float) -> bool:
	if float(hero_stats["mana"]) < amount:
		return false
	hero_stats["mana"] = float(hero_stats["mana"]) - amount
	hero_stats_changed.emit(hero_stats.duplicate(true))
	return true

func add_item(item_data: Dictionary) -> void:
	inventory.append(item_data)
	inventory_changed.emit(inventory.duplicate(true))

func unequip_slot(slot: String) -> void:
	if not equipment.has(slot):
		return
	var old_item: Dictionary = equipment[slot]
	if old_item.is_empty():
		return
	var old_stats: Dictionary = old_item["stats"] if old_item.has("stats") else {}
	for stat_key: String in old_stats.keys():
		hero_stats[stat_key] = float(hero_stats.get(stat_key, 0.0)) - float(old_stats[stat_key])
	equipment[slot] = {}

func equip_item(item_data: Dictionary) -> void:
	var slot: String = str(item_data.get("slot", ""))
	if slot == "":
		return
	unequip_slot(slot)
	equipment[slot] = item_data
	var stats: Dictionary = item_data["stats"] if item_data.has("stats") else {}
	for stat_key: String in stats.keys():
		hero_stats[stat_key] = float(hero_stats.get(stat_key, 0.0)) + float(stats[stat_key])
	hero_stats_changed.emit(hero_stats.duplicate(true))
	inventory_changed.emit(inventory.duplicate(true))

func required_xp_for_level(current_level: int) -> int:
	return BASE_REQUIRED_XP + int((current_level - 1) * 45.0)

func next_wave() -> void:
	wave_index += 1

func _apply_level_growth() -> void:
	hero_stats["max_health"] = float(hero_stats["max_health"]) + 10.0
	hero_stats["max_mana"] = float(hero_stats["max_mana"]) + 6.0
	hero_stats["attack_damage"] = float(hero_stats["attack_damage"]) + 2.0
	hero_stats["ability_power"] = float(hero_stats["ability_power"]) + 2.0
	hero_stats["health"] = hero_stats["max_health"]
	hero_stats["mana"] = hero_stats["max_mana"]
	hero_stats_changed.emit(hero_stats.duplicate(true))

func _try_unlock_ability() -> void:
	if level == 3 and not unlocked_abilities.has("flame_wave"):
		unlocked_abilities.append("flame_wave")
	elif level == 6 and not unlocked_abilities.has("chain_blast"):
		unlocked_abilities.append("chain_blast")
	elif level == 9 and not unlocked_abilities.has("nova_guard"):
		unlocked_abilities.append("nova_guard")

func _emit_all() -> void:
	gold_changed.emit(gold)
	xp_changed.emit(xp, required_xp_for_level(level))
	level_changed.emit(level)
	hero_stats_changed.emit(hero_stats.duplicate(true))
	inventory_changed.emit(inventory.duplicate(true))
