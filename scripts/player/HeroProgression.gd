extends Node

signal ability_unlocked(ability_id: String)

var known_abilities: Array[String] = []
var observed_level := 1

func _ready() -> void:
	known_abilities = GameState.unlocked_abilities.duplicate()
	observed_level = GameState.level
	GameState.level_changed.connect(_on_level_changed)

func _on_level_changed(new_level: int) -> void:
	observed_level = new_level
	for ability_id in GameState.unlocked_abilities:
		if not known_abilities.has(ability_id):
			known_abilities.append(ability_id)
			ability_unlocked.emit(ability_id)
