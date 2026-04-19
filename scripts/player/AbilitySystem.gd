extends Node

signal ability_cast(ability_id: String, target: Node3D)

var cooldowns := {}

var ability_defs := {
	"arc_bolt": {"mana_cost": 12.0, "cooldown": 2.8, "damage_mult": 1.6},
	"flame_wave": {"mana_cost": 22.0, "cooldown": 7.5, "damage_mult": 2.2},
	"chain_blast": {"mana_cost": 30.0, "cooldown": 11.0, "damage_mult": 2.9},
	"nova_guard": {"mana_cost": 34.0, "cooldown": 14.0, "damage_mult": 3.2}
}

func _process(delta: float) -> void:
	for key in cooldowns.keys():
		cooldowns[key] = maxf(0.0, float(cooldowns[key]) - delta)

func can_cast(ability_id: String) -> bool:
	if not GameState.unlocked_abilities.has(ability_id):
		return false
	if not ability_defs.has(ability_id):
		return false
	return float(cooldowns.get(ability_id, 0.0)) <= 0.0 and GameState.hero_stats["mana"] >= float(ability_defs[ability_id]["mana_cost"])

func cast(ability_id: String, target: Node3D) -> bool:
	if GameState == null or not ability_defs.has(ability_id):
		return false
	if not can_cast(ability_id):
		return false
	var def: Variant = ability_defs[ability_id]
	if typeof(def) != TYPE_DICTIONARY:
		return false
	var mana_cost: float = float(def.get("mana_cost", 0.0))
	if not GameState.spend_mana(mana_cost):
		return false
	cooldowns[ability_id] = float(def.get("cooldown", 1.0))
	ability_cast.emit(ability_id, target)
	return true

func get_damage_for(ability_id: String) -> float:
	if not ability_defs.has(ability_id):
		return 0.0
	var def: Variant = ability_defs[ability_id]
	if typeof(def) != TYPE_DICTIONARY:
		return 0.0
	var mult: float = float(def.get("damage_mult", 1.0))
	var power: float = 0.0
	if GameState != null and typeof(GameState.hero_stats) == TYPE_DICTIONARY:
		power = float(GameState.hero_stats.get("ability_power", 8.0))
	return power * mult
