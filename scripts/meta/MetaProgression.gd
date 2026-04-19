extends Node

const TRAIT_CAP := 10
const TRAIT_COST_BASE := 150

var trait_levels := {
	"max_health": 0,
	"max_mana": 0,
	"attack_damage": 0
}

func get_starting_bonus(stat_name: String) -> float:
	var level := int(trait_levels.get(stat_name, 0))
	match stat_name:
		"max_health":
			return level * 8.0
		"max_mana":
			return level * 5.0
		"attack_damage":
			return level * 1.5
	return 0.0

func upgrade_cost(stat_name: String) -> int:
	var lvl := int(trait_levels.get(stat_name, 0))
	return TRAIT_COST_BASE + (lvl * 75)

func can_upgrade(stat_name: String) -> bool:
	return int(trait_levels.get(stat_name, 0)) < TRAIT_CAP

func upgrade_trait(stat_name: String) -> bool:
	if not can_upgrade(stat_name):
		return false
	var cost := upgrade_cost(stat_name)
	if not GameState.spend_gold(cost):
		return false
	trait_levels[stat_name] = int(trait_levels.get(stat_name, 0)) + 1
	ProfileData.meta_traits[stat_name] = trait_levels[stat_name]
	return true

func set_trait_levels(levels: Dictionary) -> void:
	for k in trait_levels.keys():
		trait_levels[k] = int(levels.get(k, trait_levels[k]))
