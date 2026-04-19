extends CharacterBody3D

signal enemy_died(enemy: Node)

@export var attack_range := 2.0
@export var attack_cooldown := 1.5

var max_health := 360.0
var health := 360.0
var damage := 24.0
var move_speed := 1.7
var xp_reward := 200
var gold_reward := 110
var town_target: Node3D
var hero_target: Node3D
var attack_timer := 0.0
var _anim_player: AnimationPlayer

enum Phase { NORMAL, ENRAGED, DESPERATE }
var current_phase := Phase.NORMAL
var stomp_timer := 0.0
const STOMP_INTERVAL := 6.0
const STOMP_RANGE := 5.0
const STOMP_DAMAGE_MULT := 0.6
var charge_timer := 0.0
const CHARGE_INTERVAL := 8.0
const CHARGE_SPEED_MULT := 3.5
const CHARGE_DURATION := 0.8
var _charging := false
var _charge_elapsed := 0.0
var _charge_dir := Vector3.ZERO

const ENEMY_PROJECTILE_SCENE: PackedScene = preload("res://scenes/enemies/EnemyProjectile.tscn")

func configure(wave_number: int, town_node: Node3D, hero_node: Node3D) -> void:
	town_target = town_node
	hero_target = hero_node
	var stats := BalanceTables.enemy_stats("boss", wave_number)
	max_health = float(stats["health"])
	health = max_health
	move_speed = float(stats["speed"])
	damage = float(stats["damage"])
	xp_reward = int(stats["xp"])
	gold_reward = int(stats["gold"])
	_anim_player = get_node_or_null("AnimationPlayer") as AnimationPlayer
	if _anim_player == null and has_node("Model"):
		_anim_player = get_node_or_null("Model/AnimationPlayer") as AnimationPlayer
	_set_visual()

func _physics_process(delta: float) -> void:
	attack_timer = maxf(0.0, attack_timer - delta)
	stomp_timer = maxf(0.0, stomp_timer - delta)
	charge_timer = maxf(0.0, charge_timer - delta)
	_update_phase()

	if _charging:
		_charge_elapsed += delta
		velocity = _charge_dir * move_speed * CHARGE_SPEED_MULT
		move_and_slide()
		_check_charge_collision()
		if _charge_elapsed >= CHARGE_DURATION:
			_charging = false
		return

	var target := _pick_target()
	if target == null:
		velocity = Vector3.ZERO
		_play_anim("idle")
		move_and_slide()
		return

	var offset := target.global_position - global_position
	offset.y = 0.0
	var distance := offset.length()

	if current_phase != Phase.NORMAL and charge_timer <= 0.0 and distance > 4.0 and distance < 15.0:
		charge_timer = CHARGE_INTERVAL
		_start_charge(target)
		return

	if current_phase == Phase.DESPERATE and stomp_timer <= 0.0 and distance <= STOMP_RANGE:
		stomp_timer = STOMP_INTERVAL
		_do_stomp()

	if distance <= attack_range:
		velocity = Vector3.ZERO
		_play_anim("idle")
		if attack_timer <= 0.0:
			attack_timer = attack_cooldown
			_do_attack(target)
	else:
		var spd := move_speed
		if current_phase == Phase.ENRAGED:
			spd *= 1.3
		elif current_phase == Phase.DESPERATE:
			spd *= 1.5
		velocity = offset.normalized() * spd
		_play_anim("walk")
		move_and_slide()

func _update_phase() -> void:
	var hp_pct := health / max_health
	if hp_pct <= 0.3 and current_phase != Phase.DESPERATE:
		current_phase = Phase.DESPERATE
		_set_phase_visual()
	elif hp_pct <= 0.6 and current_phase == Phase.NORMAL:
		current_phase = Phase.ENRAGED
		_set_phase_visual()

func _start_charge(target: Node3D) -> void:
	_charging = true
	_charge_elapsed = 0.0
	var dir := (target.global_position - global_position)
	dir.y = 0.0
	_charge_dir = dir.normalized()

func _check_charge_collision() -> void:
	if hero_target == null or not is_instance_valid(hero_target):
		return
	if not hero_target.has_method("is_alive") or not hero_target.is_alive():
		return
	if global_position.distance_to(hero_target.global_position) < 2.5:
		if hero_target.has_method("receive_damage"):
			hero_target.receive_damage(damage * 1.5)
		_charging = false

func _do_stomp() -> void:
	_play_anim("attack")
	for body in get_tree().get_nodes_in_group("enemies"):
		pass
	if hero_target != null and is_instance_valid(hero_target):
		if hero_target.has_method("is_alive") and hero_target.is_alive():
			var dist := global_position.distance_to(hero_target.global_position)
			if dist <= STOMP_RANGE and hero_target.has_method("receive_damage"):
				hero_target.receive_damage(damage * STOMP_DAMAGE_MULT)
	if town_target != null and is_instance_valid(town_target):
		var dist := global_position.distance_to(town_target.global_position)
		if dist <= STOMP_RANGE and town_target.has_method("receive_damage"):
			town_target.receive_damage(damage * STOMP_DAMAGE_MULT)

func receive_damage(amount: float) -> void:
	health -= amount
	if health <= 0.0:
		_die()

func get_health_pct() -> float:
	return health / max_health if max_health > 0.0 else 0.0

func _pick_target() -> Node3D:
	if hero_target != null and hero_target.has_method("is_alive") and hero_target.is_alive():
		return hero_target
	return town_target

func _do_attack(target: Node3D) -> void:
	_play_anim("attack")
	if target == null:
		return
	if target.has_method("receive_damage"):
		target.receive_damage(damage)

func _play_anim(anim_name: String) -> void:
	if _anim_player == null:
		return
	if _anim_player.has_animation(anim_name):
		_anim_player.play(anim_name)

func _die() -> void:
	GameState.add_xp(xp_reward)
	GameState.add_gold(gold_reward)
	WaveDirector.on_enemy_killed()
	enemy_died.emit(self)
	_play_anim("death")
	if _anim_player != null and _anim_player.has_animation("death"):
		await get_tree().create_timer(0.8).timeout
	queue_free()

func _set_visual() -> void:
	if not has_node("MeshInstance3D"):
		return
	var mesh_node := $MeshInstance3D
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.85, 0.1, 0.1)
	mesh_node.material_override = mat
	scale = Vector3(2.2, 2.2, 2.2)

func _set_phase_visual() -> void:
	if not has_node("MeshInstance3D"):
		return
	var mesh_node := $MeshInstance3D
	var mat := StandardMaterial3D.new()
	match current_phase:
		Phase.ENRAGED:
			mat.albedo_color = Color(1.0, 0.3, 0.0)
			mat.emission_enabled = true
			mat.emission = Color(1.0, 0.2, 0.0)
			mat.emission_energy_multiplier = 0.4
		Phase.DESPERATE:
			mat.albedo_color = Color(1.0, 0.0, 0.0)
			mat.emission_enabled = true
			mat.emission = Color(1.0, 0.0, 0.0)
			mat.emission_energy_multiplier = 0.8
			scale = Vector3(2.4, 2.4, 2.4)
	mesh_node.material_override = mat
