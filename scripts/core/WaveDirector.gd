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
var is_boss_wave := false
var boss_spawned := false

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
		is_boss_wave = false
		boss_spawned = false
		wave_cleared.emit(GameState.wave_index)

func start_next_wave() -> void:
	if wave_active:
		return
	GameState.next_wave()
	var wave_number := GameState.wave_index
	is_boss_wave = wave_number % 5 == 0
	boss_spawned = false
	var budget := BalanceTables.enemy_budget_for_wave(wave_number)
	if is_boss_wave:
		# 1 boss + a smaller pack of adds. Avoids the old behavior where a wave
		# could roll multiple bosses or none at all.
		budget = 1 + int(ceil(budget * 0.4))
	enemies_to_spawn = budget
	alive_enemies = 0
	spawn_interval = maxf(0.25, 0.95 - (wave_number * 0.04))
	spawn_timer = 0.15
	wave_active = true
	wave_started.emit(wave_number, budget)
	if is_boss_wave:
		boss_wave_started.emit(wave_number)

func on_enemy_killed() -> void:
	alive_enemies = max(0, alive_enemies - 1)

func _pick_enemy_type() -> String:
	if is_boss_wave and not boss_spawned:
		boss_spawned = true
		return "boss"
	var weights := BalanceTables.enemy_weights_for_wave(GameState.wave_index)
	# On boss waves, never roll another boss from the random pool.
	if is_boss_wave and weights.has("boss"):
		weights = weights.duplicate()
		weights.erase("boss")
	var total := 0.0
	for value in weights.values():
		total += float(value)
	if total <= 0.0:
		return "basic"
	var roll := randf() * total
	var cumulative := 0.0
	for enemy_type in weights.keys():
		cumulative += float(weights[enemy_type])
		if roll <= cumulative:
			return enemy_type
	return "basic"
