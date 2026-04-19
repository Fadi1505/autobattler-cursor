extends CharacterBody3D

signal enemy_died(enemy: Node)

@export var enemy_type := "basic"
@export var attack_range := 1.35
@export var attack_cooldown := 1.2

var max_health := 50.0
var health := 50.0
var damage := 8.0
var move_speed := 3.0
var xp_reward := 24
var gold_reward := 14
var town_target: Node3D
var hero_target: Node3D
var attack_timer := 0.0
var _anim_player: AnimationPlayer
var ranged_attack_range := 10.0
var preferred_distance := 7.0
var support_aura_range := 6.0
var support_aura_timer := 0.0
const SUPPORT_AURA_INTERVAL := 3.0
const SUPPORT_HEAL_AMOUNT := 0.08
const SUPPORT_SPEED_BUFF := 1.25
const ENEMY_PROJECTILE_SCENE: PackedScene = preload("res://scenes/enemies/EnemyProjectile.tscn")

func configure(type_name: String, wave_number: int, town_node: Node3D, hero_node: Node3D) -> void:
	enemy_type = type_name
	town_target = town_node
	hero_target = hero_node
	var stats := BalanceTables.enemy_stats(type_name, wave_number)
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

	if enemy_type == "support":
		support_aura_timer -= delta
		if support_aura_timer <= 0.0:
			support_aura_timer = SUPPORT_AURA_INTERVAL
			_apply_support_aura()

	if enemy_type == "ranged":
		_process_ranged(delta)
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
	if distance <= attack_range:
		velocity = Vector3.ZERO
		_play_anim("idle")
		if attack_timer <= 0.0:
			attack_timer = attack_cooldown
			_do_attack(target)
	else:
		velocity = offset.normalized() * move_speed
		_play_anim("walk")
		move_and_slide()

func _process_ranged(delta: float) -> void:
	var target := _pick_target()
	if target == null:
		velocity = Vector3.ZERO
		_play_anim("idle")
		move_and_slide()
		return
	var offset := target.global_position - global_position
	offset.y = 0.0
	var distance := offset.length()

	if distance <= ranged_attack_range:
		if distance < preferred_distance * 0.6:
			velocity = -offset.normalized() * move_speed
			_play_anim("walk")
		else:
			velocity = Vector3.ZERO
			_play_anim("idle")
		if attack_timer <= 0.0:
			attack_timer = attack_cooldown
			_fire_projectile(target)
	else:
		velocity = offset.normalized() * move_speed
		_play_anim("walk")
	move_and_slide()

func _fire_projectile(target: Node3D) -> void:
	_play_anim("attack")
	var proj: Area3D = ENEMY_PROJECTILE_SCENE.instantiate() as Area3D
	if proj == null:
		return
	var world: Node = get_tree().current_scene
	if world == null:
		world = get_parent()
	world.add_child(proj)
	proj.global_position = global_position + Vector3(0, 0.8, 0)
	var dir := (target.global_position + Vector3(0, 0.5, 0) - proj.global_position).normalized()
	proj.direction = dir
	proj.look_at(proj.global_position + dir, Vector3.UP)
	proj.source_enemy = self
	proj.damage = damage
	proj.speed = 12.0

func _apply_support_aura() -> void:
	for ally in get_tree().get_nodes_in_group("enemies"):
		if ally == self or not is_instance_valid(ally):
			continue
		if not ally.has_method("receive_damage"):
			continue
		var dist := global_position.distance_to(ally.global_position)
		if dist <= support_aura_range:
			ally.health = minf(ally.max_health, ally.health + ally.max_health * SUPPORT_HEAL_AMOUNT)

func receive_damage(amount: float) -> void:
	health -= amount
	if health <= 0.0:
		_die()

func _pick_target() -> Node3D:
	if hero_target != null and hero_target.has_method("is_alive") and hero_target.is_alive():
		var hero_distance := global_position.distance_to(hero_target.global_position)
		if hero_distance < 7.5:
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
		await get_tree().create_timer(0.6).timeout
	queue_free()

func _set_visual() -> void:
	if not has_node("MeshInstance3D"):
		return
	var mesh_node := $MeshInstance3D
	var mat := StandardMaterial3D.new()
	match enemy_type:
		"tank":
			mat.albedo_color = Color(0.3, 0.4, 0.9)
			scale = Vector3(1.3, 1.3, 1.3)
		"runner":
			mat.albedo_color = Color(0.9, 0.8, 0.3)
			scale = Vector3(0.85, 0.85, 0.85)
		"ranged":
			mat.albedo_color = Color(0.8, 0.3, 0.8)
		"support":
			mat.albedo_color = Color(0.3, 0.9, 0.6)
		"elite":
			mat.albedo_color = Color(0.95, 0.35, 0.2)
			scale = Vector3(1.45, 1.45, 1.45)
		"boss":
			mat.albedo_color = Color(0.85, 0.1, 0.1)
			scale = Vector3(2.0, 2.0, 2.0)
		_:
			mat.albedo_color = Color(0.8, 0.4, 0.2)
	mesh_node.material_override = mat
