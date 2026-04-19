extends Node3D

@onready var hero: CharacterBody3D = $Hero
@onready var town_core: Node3D = $TownHub/TownCore
@onready var spawn_point: Marker3D = $LaneMap/SpawnPoint
@onready var world_ui: CanvasLayer = $WorldUI
@onready var wave_timer: Timer = $WaveStartTimer
@onready var tower_placement: Node3D = $TowerPlacement
@onready var tower_build_ui: Control = $WorldUI/TowerBuildUI

const KILL_PLANE_Y := -15.0
const HERO_RESPAWN_POSITION := Vector3(0.0, 0.2, 8.0)

var enemy_scene := preload("res://scenes/enemies/Enemy.tscn")
var boss_scene := preload("res://scenes/enemies/BossEnemy.tscn")
var active_enemies: Array[Node] = []
var active_boss: Node = null
var run_over := false
var _pending_tower_slot := {}
var _pending_tower_for_upgrade: Node3D = null

func _physics_process(_delta: float) -> void:
	if run_over:
		return
	if hero.global_position.y < KILL_PLANE_Y:
		_respawn_hero()
	if active_boss != null and is_instance_valid(active_boss) and active_boss.has_method("get_health_pct"):
		world_ui.update_boss_bar(active_boss.get_health_pct())

func _respawn_hero() -> void:
	hero.global_position = HERO_RESPAWN_POSITION
	hero.velocity = Vector3.ZERO
	if world_ui != null:
		world_ui.set_status_text("Fell off! Respawned at town.")

func _ready() -> void:
	WaveDirector.spawn_requested.connect(_on_spawn_requested)
	WaveDirector.wave_started.connect(_on_wave_started)
	WaveDirector.wave_cleared.connect(_on_wave_cleared)
	WaveDirector.boss_wave_started.connect(_on_boss_wave_started)
	GameState.wave_failed.connect(_on_run_failed)
	GameState.run_won.connect(_on_run_won)
	GameState.level_changed.connect(_on_level_changed)
	wave_timer.timeout.connect(_on_wave_timeout)
	wave_timer.start()
	if town_core != null and town_core.has_signal("town_health_changed"):
		town_core.town_health_changed.connect(_on_town_health_changed)
	call_deferred("_refresh_town_hp")
	SaveSystem.load_profile()
	if tower_build_ui != null:
		tower_build_ui.build_requested.connect(_on_tower_build_requested)
		tower_build_ui.upgrade_requested.connect(_on_tower_upgrade_requested)

func _refresh_town_hp() -> void:
	if town_core != null and world_ui != null:
		world_ui.set_town_health(town_core.health, town_core.max_health)

func _on_town_health_changed(current: float, maximum: float) -> void:
	world_ui.set_town_health(current, maximum)

func _on_wave_started(wave_number: int, budget: int) -> void:
	var is_boss: bool = wave_number % 5 == 0
	world_ui.set_wave_number(wave_number, is_boss)
	world_ui.set_status_text("Wave %d started (%d enemies)" % [wave_number, budget])

func _on_boss_wave_started(wave_number: int) -> void:
	world_ui.set_status_text("Boss wave!")

func _on_wave_cleared(wave_number: int) -> void:
	if run_over:
		return
	if wave_number >= 15:
		world_ui.set_status_text("Victory! You defended the town.")
		GameState.run_won.emit()
		return
	world_ui.set_status_text("Wave %d cleared. Prepare..." % wave_number)
	wave_timer.start(4.0)

func _on_wave_timeout() -> void:
	if run_over:
		return
	WaveDirector.start_next_wave()

func _on_spawn_requested(enemy_type: String) -> void:
	if enemy_type == "boss":
		_spawn_boss()
		return
	var enemy := enemy_scene.instantiate()
	add_child(enemy)
	enemy.global_position = spawn_point.global_position + Vector3(randf_range(-2.0, 2.0), 0.0, randf_range(-2.0, 2.0))
	enemy.add_to_group("enemies")
	enemy.configure(enemy_type, GameState.wave_index, town_core, hero)
	enemy.enemy_died.connect(_on_enemy_died)
	active_enemies.append(enemy)

func _spawn_boss() -> void:
	var boss := boss_scene.instantiate()
	add_child(boss)
	boss.global_position = spawn_point.global_position + Vector3(0.0, 0.0, 0.0)
	boss.add_to_group("enemies")
	boss.configure(GameState.wave_index, town_core, hero)
	boss.enemy_died.connect(_on_enemy_died)
	boss.enemy_died.connect(_on_boss_died)
	active_enemies.append(boss)
	active_boss = boss
	world_ui.show_boss_bar(true)
	world_ui.update_boss_bar(1.0)

func _on_enemy_died(enemy: Node) -> void:
	active_enemies.erase(enemy)

func _on_boss_died(_enemy: Node) -> void:
	active_boss = null
	world_ui.show_boss_bar(false)

func _on_level_changed(level: int) -> void:
	world_ui.set_level_text(level)

func _on_run_failed() -> void:
	if run_over:
		return
	run_over = true
	world_ui.show_run_over(false)
	_finalize_run()

func _on_run_won() -> void:
	if run_over:
		return
	run_over = true
	world_ui.show_run_over(true)
	_finalize_run()

func _finalize_run() -> void:
	ProfileData.total_runs += 1
	ProfileData.total_gold_earned += GameState.gold
	ProfileData.highest_wave = max(ProfileData.highest_wave, GameState.wave_index)
	SaveSystem.save_profile()

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("build_tower"):
		_try_open_tower_ui()

func _try_open_tower_ui() -> void:
	if tower_placement == null or tower_build_ui == null:
		return
	var occupied_slot := tower_placement.get_nearest_tower_slot(hero.global_position, 5.0)
	if not occupied_slot.is_empty():
		_pending_tower_for_upgrade = occupied_slot["tower"]
		_pending_tower_slot = {}
		tower_build_ui.call("open_upgrade", occupied_slot["tower"])
		return
	var empty_slot := tower_placement.get_nearest_empty_slot(hero.global_position, 5.0)
	if empty_slot.is_empty():
		world_ui.set_status_text("No tower slot nearby. Walk along the lane borders.")
		return
	_pending_tower_slot = empty_slot
	_pending_tower_for_upgrade = null
	tower_build_ui.call("open_build")

func _on_tower_build_requested(tower_type: String) -> void:
	if _pending_tower_slot.is_empty():
		return
	if tower_placement.place_tower(_pending_tower_slot, tower_type):
		world_ui.set_status_text("Built %s tower!" % tower_type.capitalize())
	else:
		world_ui.set_status_text("Not enough gold.")
	_pending_tower_slot = {}

func _on_tower_upgrade_requested() -> void:
	if _pending_tower_for_upgrade == null or not is_instance_valid(_pending_tower_for_upgrade):
		return
	if _pending_tower_for_upgrade.try_upgrade():
		world_ui.set_status_text("Tower upgraded to tier %d!" % _pending_tower_for_upgrade.tier)
	else:
		world_ui.set_status_text("Cannot upgrade (max tier or not enough gold).")
	_pending_tower_for_upgrade = null
	tower_build_ui.visible = false

func _exit_tree() -> void:
	if WaveDirector.spawn_requested.is_connected(_on_spawn_requested):
		WaveDirector.spawn_requested.disconnect(_on_spawn_requested)
