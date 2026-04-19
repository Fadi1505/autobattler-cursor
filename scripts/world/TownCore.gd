extends Node3D

signal town_health_changed(current: float, maximum: float)

@export var max_health := 400.0
var health := 400.0

func _ready() -> void:
	health = max_health
	town_health_changed.emit(health, max_health)

func receive_damage(amount: float) -> void:
	health = maxf(0.0, health - amount)
	town_health_changed.emit(health, max_health)
	if health <= 0.0:
		GameState.wave_failed.emit()
