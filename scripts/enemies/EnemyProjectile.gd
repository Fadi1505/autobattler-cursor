extends Area3D

var direction: Vector3 = Vector3.FORWARD
var speed: float = 14.0
var damage: float = 8.0
var max_distance: float = 16.0
var traveled: float = 0.0
var source_enemy: Node3D

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _physics_process(delta: float) -> void:
	var step: float = speed * delta
	global_position += direction * step
	traveled += step
	if traveled >= max_distance:
		queue_free()

func _on_body_entered(body: Node3D) -> void:
	if source_enemy != null and body == source_enemy:
		return
	if body.is_in_group("enemies"):
		return
	if body.has_method("receive_damage"):
		body.receive_damage(damage)
		queue_free()
