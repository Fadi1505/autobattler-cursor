extends Node3D

signal tower_upgraded(tower: Node3D)

@export var tower_type := "archer"
var tier := 1
var attack_range := 8.0
var attack_damage := 12.0
var attack_cooldown := 1.2
var attack_timer := 0.0
var target_enemy: Node3D

const TOWER_DEFS := {
	"archer": {"range": 10.0, "damage": 10.0, "cooldown": 0.9, "upgrade_cost": 60},
	"slow": {"range": 7.0, "damage": 4.0, "cooldown": 1.8, "upgrade_cost": 70},
	"cannon": {"range": 6.0, "damage": 28.0, "cooldown": 2.5, "upgrade_cost": 80}
}

const PROJECTILE_SCENE: PackedScene = preload("res://scenes/player/MagicBolt.tscn")

func configure(type_name: String) -> void:
	tower_type = type_name
	var def: Dictionary = TOWER_DEFS.get(type_name, TOWER_DEFS["archer"])
	attack_range = float(def["range"])
	attack_damage = float(def["damage"])
	attack_cooldown = float(def["cooldown"])
	_set_visual()

func _physics_process(delta: float) -> void:
	attack_timer = maxf(0.0, attack_timer - delta)
	_acquire_target()
	if target_enemy != null and is_instance_valid(target_enemy) and attack_timer <= 0.0:
		attack_timer = attack_cooldown
		_fire()

func _acquire_target() -> void:
	if target_enemy != null and is_instance_valid(target_enemy):
		if global_position.distance_to(target_enemy.global_position) <= attack_range:
			return
	target_enemy = null
	var best_dist := INF
	for enemy in get_tree().get_nodes_in_group("enemies"):
		if not is_instance_valid(enemy):
			continue
		var dist := global_position.distance_to(enemy.global_position)
		if dist <= attack_range and dist < best_dist:
			target_enemy = enemy
			best_dist = dist

func _fire() -> void:
	if target_enemy == null or not is_instance_valid(target_enemy):
		return
	if tower_type == "slow":
		_fire_slow()
		return
	var bolt: Area3D = PROJECTILE_SCENE.instantiate() as Area3D
	if bolt == null:
		return
	var world: Node = get_tree().current_scene
	if world == null:
		world = get_parent()
	world.add_child(bolt)
	bolt.global_position = global_position + Vector3(0, 1.5, 0)
	var dir := (target_enemy.global_position + Vector3(0, 0.5, 0) - bolt.global_position).normalized()
	bolt.direction = dir
	bolt.look_at(bolt.global_position + dir, Vector3.UP)
	bolt.caster = self
	bolt.damage = attack_damage * tier
	bolt.speed = 16.0
	bolt.max_distance = attack_range + 2.0

func _fire_slow() -> void:
	if not target_enemy.has_method("receive_damage"):
		return
	target_enemy.receive_damage(attack_damage * tier)
	if "move_speed" in target_enemy:
		var original_speed: float = target_enemy.move_speed
		target_enemy.move_speed *= 0.5
		get_tree().create_timer(1.5).timeout.connect(func() -> void:
			if is_instance_valid(target_enemy):
				target_enemy.move_speed = original_speed
		)

func get_upgrade_cost() -> int:
	var def: Dictionary = TOWER_DEFS.get(tower_type, TOWER_DEFS["archer"])
	return int(def["upgrade_cost"]) * tier

func try_upgrade() -> bool:
	if tier >= 3:
		return false
	var cost := get_upgrade_cost()
	if not GameState.spend_gold(cost):
		return false
	tier += 1
	attack_damage *= 1.4
	attack_cooldown *= 0.85
	_set_visual()
	tower_upgraded.emit(self)
	return true

func _set_visual() -> void:
	if not has_node("MeshInstance3D"):
		return
	var mesh_node := $MeshInstance3D
	var mat := StandardMaterial3D.new()
	match tower_type:
		"archer":
			mat.albedo_color = Color(0.3, 0.7, 0.3)
		"slow":
			mat.albedo_color = Color(0.3, 0.5, 0.9)
		"cannon":
			mat.albedo_color = Color(0.8, 0.4, 0.2)
	if tier >= 2:
		mat.emission_enabled = true
		mat.emission = mat.albedo_color
		mat.emission_energy_multiplier = 0.3 * tier
	mesh_node.material_override = mat
