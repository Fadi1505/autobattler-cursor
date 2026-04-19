extends Node

signal wave_started(wave_number: int, enemy_budget: int)
signal spawn_requested(enemy_type: String)
signal wave_cleared(wave_number: int)
signal boss_wave_started(wave_number: int)

var wave_active := false
var alive_enemies := 0
var enemies_to_spawn := 0
var spawn_interval := 0.85
var spawn_timer := 0.0
var max_alive_enemies := 45

func _process(delta: float) -> void:
	if not wave_active:
		return

	spawn_timer -= delta
	if spawn_timer <= 0.0 and enemies_to_spawn > 0 and alive_enemies < max_alive_enemies:
		spawn_timer = spawn_interval
		enemies_to_spawn -= 1
		alive_enemies += 1
		spawn_requested.emit(_pick_enemy_type())

	if enemies_to_spawn == 0 and alive_enemies <= 0:
		wave_active = false
		wave_cleared.emit(GameState.wave_index)

func start_next_wave() -> void:
	if wave_active:
		return
	GameState.next_wave()
	var wave_number := GameState.wave_index
	var budget := BalanceTables.enemy_budget_for_wave(wave_number)
	enemies_to_spawn = budget
	alive_enemies = 0
	spawn_interval = maxf(0.25, 0.95 - (wave_number * 0.04))
	spawn_timer = 0.15
	wave_active = true
	wave_started.emit(wave_number, budget)
	if wave_number % 5 == 0:
		boss_wave_started.emit(wave_number)

func on_enemy_killed() -> void:
	alive_enemies = max(0, alive_enemies - 1)

func _pick_enemy_type() -> String:
	var weights := BalanceTables.enemy_weights_for_wave(GameState.wave_index)
	var roll := randf()
	var cumulative := 0.0
	for enemy_type in weights.keys():
		cumulative += weights[enemy_type]
		if roll <= cumulative:
			return enemy_type
	return "basic"
