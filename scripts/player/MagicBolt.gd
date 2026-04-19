extends Area3D

var direction: Vector3 = Vector3.FORWARD
var speed: float = 18.0
var damage: float = 10.0
var max_distance: float = 22.0
var traveled: float = 0.0
var caster: Node3D

var chain_bounces := 0
var chain_range := 8.0
var _hit_enemies: Array[Node3D] = []

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _physics_process(delta: float) -> void:
	var step: float = speed * delta
	global_position += direction * step
	traveled += step
	if traveled >= max_distance:
		queue_free()

func _on_body_entered(body: Node3D) -> void:
	if caster != null and (body == caster or body.get_parent() == caster):
		return
	if body.is_in_group("enemies") and body.has_method("receive_damage"):
		body.receive_damage(damage)
		_hit_enemies.append(body)
		if chain_bounces > 0:
			_try_chain(body)
		else:
			queue_free()

func _try_chain(from_enemy: Node3D) -> void:
	chain_bounces -= 1
	damage *= 0.7
	var enemies := get_tree().get_nodes_in_group("enemies")
	var best: Node3D
	var best_dist := INF
	for e in enemies:
		if not is_instance_valid(e) or _hit_enemies.has(e):
			continue
		var dist := from_enemy.global_position.distance_to(e.global_position)
		if dist < best_dist and dist <= chain_range:
			best = e
			best_dist = dist
	if best == null:
		queue_free()
		return
	global_position = from_enemy.global_position + Vector3(0, 0.5, 0)
	direction = (best.global_position + Vector3(0, 0.5, 0) - global_position).normalized()
	look_at(global_position + direction, Vector3.UP)
	traveled = 0.0
