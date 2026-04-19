extends Node

var highest_wave: int = 0
var total_gold_earned: int = 0
var total_runs: int = 0
var meta_traits := {
	"max_health": 0,
	"max_mana": 0,
	"attack_damage": 0
}
var settings := {
	"master_volume": 0.8,
	"sfx_volume": 0.9,
	"music_volume": 0.65
}
var keybinds := {}

func to_dict() -> Dictionary:
	return {
		"highest_wave": highest_wave,
		"total_gold_earned": total_gold_earned,
		"total_runs": total_runs,
		"meta_traits": meta_traits,
		"settings": settings,
		"keybinds": keybinds
	}

func from_dict(data: Dictionary) -> void:
	highest_wave = int(data.get("highest_wave", highest_wave))
	total_gold_earned = int(data.get("total_gold_earned", total_gold_earned))
	total_runs = int(data.get("total_runs", total_runs))
	var incoming_traits: Dictionary = meta_traits
	if data.has("meta_traits") and typeof(data["meta_traits"]) == TYPE_DICTIONARY:
		incoming_traits = data["meta_traits"] as Dictionary
	for k in incoming_traits.keys():
		meta_traits[k] = int(incoming_traits[k])
	var incoming_settings: Dictionary = settings
	if data.has("settings") and typeof(data["settings"]) == TYPE_DICTIONARY:
		incoming_settings = data["settings"] as Dictionary
	for k in incoming_settings.keys():
		settings[k] = float(incoming_settings[k])
	var incoming_keybinds: Dictionary = {}
	if data.has("keybinds") and typeof(data["keybinds"]) == TYPE_DICTIONARY:
		incoming_keybinds = data["keybinds"] as Dictionary
	keybinds = incoming_keybinds.duplicate(true)
