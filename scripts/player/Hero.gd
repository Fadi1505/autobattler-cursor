extends CharacterBody3D

@onready var spring_arm: SpringArm3D = $SpringArm3D
@onready var camera: Camera3D = $SpringArm3D/Camera3D
@onready var ability_system: Node = $AbilitySystem
@onready var progression: Node = $HeroProgression

@export var gravity := 19.0
@export var turn_speed := 8.0
@export var jump_velocity := 8.5
@export var base_attack_range := 20.0
const MAGIC_BOLT_SCENE: PackedScene = preload("res://scenes/player/MagicBolt.tscn")
@export var camera_pitch_degrees := -16.0
@export var camera_distance := 6.5

var nova_shield_active := false
var nova_shield_amount := 0.0
var nova_shield_timer := 0.0
const NOVA_SHIELD_DURATION := 5.0

var target_enemy: Node3D
var attack_timer := 0.0
var alive := true
var _anim_player: AnimationPlayer
var _model: Node3D
var _anim_pivot: Node3D

func _ready() -> void:
	# Wrap Model in AnimPivot so we control rotation and animation in one place (avoids GLB overwriting)
	if has_node("Model"):
		_model = get_node("Model")
		_model.top_level = false
		var pivot: Node3D = Node3D.new()
		pivot.name = "AnimPivot"
		add_child(pivot)
		_model.reparent(pivot)
		_anim_pivot = pivot
	# Use fallback animations so idle/run/attack/cast always work (GLB often has none)
	var existing: Node = get_node_or_null("FallbackAnimations")
	if existing is AnimationPlayer and (existing as AnimationPlayer).has_animation("idle"):
		_anim_player = existing as AnimationPlayer
	else:
		_build_fallback_animations()
	_setup_camera_rig()
	GameState.hero_stats_changed.connect(_on_stats_changed)
	ability_system.ability_cast.connect(_on_ability_cast)
	progression.ability_unlocked.connect(_on_ability_unlocked)

func _physics_process(delta: float) -> void:
	if not alive:
		return
	attack_timer = maxf(0.0, attack_timer - delta)
	if nova_shield_active:
		nova_shield_timer -= delta
		if nova_shield_timer <= 0.0:
			nova_shield_active = false
			nova_shield_amount = 0.0

	var move_input := Input.get_vector("move_left", "move_right", "move_forward", "move_back")
	var camera_basis := camera.global_transform.basis
	var move_dir := (camera_basis.z * move_input.y + camera_basis.x * move_input.x)
	move_dir.y = 0.0
	move_dir = move_dir.normalized()

	var speed := float(GameState.hero_stats["move_speed"])
	velocity.x = move_dir.x * speed
	velocity.z = move_dir.z * speed
	velocity.y -= gravity * delta

	if Input.is_action_just_pressed("jump") and is_on_floor():
		velocity.y = jump_velocity

	# Only rotate to face movement when moving forward (not backpedaling) so camera doesn't spin
	if move_dir.length() > 0.01:
		var move_forward_amount: float = -camera_basis.z.dot(move_dir)
		if move_forward_amount > -0.3:
			var target_yaw := atan2(-move_dir.x, -move_dir.z)
			rotation.y = lerp_angle(rotation.y, target_yaw, delta * turn_speed)
	elif target_enemy != null and is_instance_valid(target_enemy):
		var look_dir := (target_enemy.global_position - global_position).normalized()
		var target_yaw_enemy := atan2(-look_dir.x, -look_dir.z)
		rotation.y = lerp_angle(rotation.y, target_yaw_enemy, delta * turn_speed)

	move_and_slide()
	if _anim_pivot != null:
		_anim_pivot.rotation.y = lerp_angle(_anim_pivot.rotation.y, rotation.y, delta * turn_speed)
	_update_animation()
	_handle_actions()

func _handle_actions() -> void:
	if Input.is_action_just_pressed("lock_target"):
		_pick_target()
	if Input.is_action_just_pressed("basic_attack"):
		_try_basic_attack()
	if Input.is_action_just_pressed("cast_skill_1"):
		ability_system.cast("arc_bolt", target_enemy)
	if Input.is_action_just_pressed("cast_skill_2"):
		ability_system.cast("flame_wave", target_enemy)
	if Input.is_action_just_pressed("cast_skill_3"):
		ability_system.cast("chain_blast", target_enemy)
	if Input.is_action_just_pressed("cast_skill_4"):
		ability_system.cast("nova_guard", target_enemy)

func _pick_target() -> void:
	var enemies := get_tree().get_nodes_in_group("enemies")
	var best: Node3D
	var best_dist := INF
	for enemy in enemies:
		if not is_instance_valid(enemy):
			continue
		var dist := global_position.distance_to(enemy.global_position)
		if dist < best_dist and dist <= 18.0:
			best = enemy
			best_dist = dist
	target_enemy = best

func _try_basic_attack() -> void:
	if attack_timer > 0.0:
		return
	if target_enemy == null or not is_instance_valid(target_enemy):
		_pick_target()
	attack_timer = 1.0 / maxf(0.1, float(GameState.hero_stats["attack_speed"]))
	_spawn_basic_attack_projectile()
	_play_anim("attack")

func _spawn_basic_attack_projectile() -> void:
	var bolt: Area3D = MAGIC_BOLT_SCENE.instantiate() as Area3D
	if bolt == null:
		return
	var world: Node = get_tree().current_scene
	if world == null:
		world = get_parent()
	world.add_child(bolt)
	bolt.global_position = global_position + Vector3(0, 1.0, 0) + (-global_transform.basis.z * 1.4)
	var dir: Vector3
	if target_enemy != null and is_instance_valid(target_enemy):
		dir = (target_enemy.global_position + Vector3(0, 0.5, 0) - bolt.global_position).normalized()
	else:
		dir = -global_transform.basis.z
	bolt.direction = dir
	bolt.rotation = Vector3.ZERO
	bolt.look_at(bolt.global_position + dir, Vector3.UP)
	bolt.caster = self
	bolt.damage = float(GameState.hero_stats["attack_damage"])
	bolt.speed = 20.0
	bolt.max_distance = base_attack_range

func _spawn_ability_projectile(ability_id: String, damage: float, target: Node3D) -> void:
	var bolt: Area3D = MAGIC_BOLT_SCENE.instantiate() as Area3D
	if bolt == null:
		return
	var world: Node = get_tree().current_scene
	if world == null:
		world = get_parent()
	world.add_child(bolt)
	bolt.global_position = global_position + Vector3(0, 1.0, 0) + (-global_transform.basis.z * 1.4)
	var dir: Vector3
	if target != null and is_instance_valid(target):
		dir = (target.global_position + Vector3(0, 0.5, 0) - bolt.global_position).normalized()
	else:
		dir = -global_transform.basis.z
	bolt.direction = dir
	bolt.rotation = Vector3.ZERO
	bolt.look_at(bolt.global_position + dir, Vector3.UP)
	bolt.caster = self
	bolt.damage = damage
	bolt.speed = 24.0
	bolt.max_distance = 18.0

func _on_ability_cast(ability_id: String, target: Node3D) -> void:
	_play_anim("cast")
	if ability_system == null:
		return
	var dmg: float = ability_system.get_damage_for(ability_id)
	match ability_id:
		"arc_bolt":
			_spawn_ability_projectile(ability_id, dmg, target)
		"flame_wave":
			_cast_flame_wave(dmg)
		"chain_blast":
			_cast_chain_blast(dmg, target)
		"nova_guard":
			_cast_nova_guard(dmg)

func _cast_flame_wave(dmg: float) -> void:
	var forward := -global_transform.basis.z.normalized()
	var origin := global_position + Vector3(0, 0.8, 0)
	var cone_angle := deg_to_rad(45.0)
	var cone_range := 7.0
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if not is_instance_valid(enemy):
			continue
		var to_enemy := (enemy.global_position - origin)
		to_enemy.y = 0.0
		if to_enemy.length() > cone_range:
			continue
		var angle := forward.angle_to(to_enemy.normalized())
		if angle <= cone_angle:
			if enemy.has_method("receive_damage"):
				enemy.receive_damage(dmg)

func _cast_chain_blast(dmg: float, target: Node3D) -> void:
	var bolt: Area3D = MAGIC_BOLT_SCENE.instantiate() as Area3D
	if bolt == null:
		return
	var world: Node = get_tree().current_scene
	if world == null:
		world = get_parent()
	world.add_child(bolt)
	bolt.global_position = global_position + Vector3(0, 1.0, 0) + (-global_transform.basis.z * 1.4)
	var dir: Vector3
	if target != null and is_instance_valid(target):
		dir = (target.global_position + Vector3(0, 0.5, 0) - bolt.global_position).normalized()
	else:
		dir = -global_transform.basis.z
	bolt.direction = dir
	bolt.rotation = Vector3.ZERO
	bolt.look_at(bolt.global_position + dir, Vector3.UP)
	bolt.caster = self
	bolt.damage = dmg
	bolt.speed = 22.0
	bolt.max_distance = 18.0
	bolt.chain_bounces = 4

func _cast_nova_guard(dmg: float) -> void:
	nova_shield_active = true
	nova_shield_amount = dmg * 2.0
	nova_shield_timer = NOVA_SHIELD_DURATION

func receive_damage(amount: float) -> void:
	if nova_shield_active:
		var absorbed := minf(amount, nova_shield_amount)
		nova_shield_amount -= absorbed
		amount -= absorbed
		if nova_shield_amount <= 0.0:
			nova_shield_active = false
		if amount <= 0.0:
			return
	GameState.apply_damage(amount)

func is_alive() -> bool:
	return alive

func _on_stats_changed(stats: Dictionary) -> void:
	if float(stats["health"]) <= 0.0:
		alive = false

func _on_ability_unlocked(_ability_id: String) -> void:
	# Hook for playing VFX/audio popup.
	pass

func _update_animation() -> void:
	if _anim_player == null:
		return
	# Don't override one-shot animations (attack/cast) until they finish
	var current: String = _anim_player.current_animation
	if current == "attack" or current == "cast":
		if _anim_player.is_playing():
			return
	var moving: bool = velocity.length() > 0.2
	var want: String = "run" if moving else "idle"
	# Only play when the desired clip changes so idle/run aren't restarted every frame
	if want != current:
		_play_anim(want)

func _play_anim(anim_name: String) -> void:
	if _anim_player == null:
		return
	if not is_instance_valid(_anim_player):
		return
	if _anim_player.has_animation(anim_name):
		_anim_player.play(anim_name)

func _build_fallback_animations() -> void:
	if not has_node("AnimPivot"):
		return
	var existing: Node = get_node_or_null("FallbackAnimations")
	if existing is AnimationPlayer:
		_anim_player = existing as AnimationPlayer
		if _anim_player.has_animation("idle"):
			_anim_player.play("idle")
			return
		else:
			existing.queue_free()
	_anim_player = AnimationPlayer.new()
	_anim_player.name = "FallbackAnimations"
	add_child(_anim_player)
	_anim_player.root_node = _anim_player.get_path_to(self)
	var pivot_path: NodePath = NodePath("AnimPivot")
	var lib: AnimationLibrary = AnimationLibrary.new()

	# Idle: subtle scale "breathing" so it reads as alive
	var idle: Animation = Animation.new()
	idle.length = 1.6
	idle.loop_mode = Animation.LOOP_LINEAR
	var idle_scale: int = idle.add_track(Animation.TYPE_SCALE_3D)
	idle.track_set_path(idle_scale, pivot_path)
	idle.track_insert_key(idle_scale, 0.0, Vector3(1, 1, 1))
	idle.track_insert_key(idle_scale, 0.8, Vector3(1.03, 1.03, 1.03))
	idle.track_insert_key(idle_scale, 1.6, Vector3(1, 1, 1))
	lib.add_animation("idle", idle)

	# Run: two-step Y bounce + squash/stretch scale
	var run: Animation = Animation.new()
	run.length = 0.5
	run.loop_mode = Animation.LOOP_LINEAR
	var run_pos: int = run.add_track(Animation.TYPE_POSITION_3D)
	run.track_set_path(run_pos, pivot_path)
	run.track_insert_key(run_pos, 0.0, Vector3(0, 0, 0))
	run.track_insert_key(run_pos, 0.125, Vector3(0, 0.08, 0))
	run.track_insert_key(run_pos, 0.25, Vector3(0, 0, 0))
	run.track_insert_key(run_pos, 0.375, Vector3(0, 0.08, 0))
	run.track_insert_key(run_pos, 0.5, Vector3(0, 0, 0))
	var run_scale: int = run.add_track(Animation.TYPE_SCALE_3D)
	run.track_set_path(run_scale, pivot_path)
	run.track_insert_key(run_scale, 0.0, Vector3(1, 1, 1))
	run.track_insert_key(run_scale, 0.125, Vector3(1.03, 0.96, 1.03))
	run.track_insert_key(run_scale, 0.25, Vector3(1, 1, 1))
	run.track_insert_key(run_scale, 0.375, Vector3(1.03, 0.96, 1.03))
	run.track_insert_key(run_scale, 0.5, Vector3(1, 1, 1))
	lib.add_animation("run", run)

	# Attack: scale punch (lunge read)
	var attack: Animation = Animation.new()
	attack.length = 0.35
	var atk_scale: int = attack.add_track(Animation.TYPE_SCALE_3D)
	attack.track_set_path(atk_scale, pivot_path)
	attack.track_insert_key(atk_scale, 0.0, Vector3(1, 1, 1))
	attack.track_insert_key(atk_scale, 0.08, Vector3(1.2, 0.88, 1.2))
	attack.track_insert_key(atk_scale, 0.35, Vector3(1, 1, 1))
	lib.add_animation("attack", attack)

	# Cast: scale pulse
	var cast: Animation = Animation.new()
	cast.length = 0.4
	var cast_scale: int = cast.add_track(Animation.TYPE_SCALE_3D)
	cast.track_set_path(cast_scale, pivot_path)
	cast.track_insert_key(cast_scale, 0.0, Vector3(1, 1, 1))
	cast.track_insert_key(cast_scale, 0.15, Vector3(1.15, 1.15, 1.15))
	cast.track_insert_key(cast_scale, 0.4, Vector3(1, 1, 1))
	lib.add_animation("cast", cast)

	_anim_player.add_animation_library("", lib)
	_anim_player.play("idle")

func _setup_camera_rig() -> void:
	spring_arm.rotation_degrees.x = camera_pitch_degrees
	spring_arm.spring_length = camera_distance
	# Exclude only the hero body (CharacterBody3D); CollisionShape3D has no get_rid().
	spring_arm.add_excluded_object(get_rid())
	camera.fov = 72.0
