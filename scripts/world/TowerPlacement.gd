extends Node3D

const TOWER_SCENE: PackedScene = preload("res://scenes/world/Tower.tscn")

const TOWER_COSTS := {
	"archer": 50,
	"slow": 65,
	"cannon": 85
}

const SLOT_SPACING := 8.0
const LANE_HALF_WIDTH := 5.5

var tower_slots: Array[Dictionary] = []
var placed_towers: Array[Node3D] = []

func _ready() -> void:
	_generate_slots()

func _generate_slots() -> void:
	var lane_map: Node3D = get_parent().get_node_or_null("LaneMap")
	if lane_map == null:
		return
	var lane_origin := lane_map.global_position
	var lane_length := 85.0
	var start_z := lane_origin.z - lane_length * 0.5 + SLOT_SPACING
	var end_z := lane_origin.z + lane_length * 0.5 - SLOT_SPACING

	var z := start_z
	var slot_id := 0
	while z <= end_z:
		for side in [-1.0, 1.0]:
			var pos := Vector3(lane_origin.x + LANE_HALF_WIDTH * side + side * 1.5, 0.2, z)
			tower_slots.append({"id": slot_id, "position": pos, "tower": null})
			slot_id += 1
		z += SLOT_SPACING

func get_slots() -> Array[Dictionary]:
	return tower_slots

func get_nearest_empty_slot(world_pos: Vector3, max_range: float = 5.0) -> Dictionary:
	var best := {}
	var best_dist := INF
	for slot in tower_slots:
		if slot["tower"] != null:
			continue
		var dist: float = world_pos.distance_to(slot["position"] as Vector3)
		if dist < best_dist and dist <= max_range:
			best = slot
			best_dist = dist
	return best

func place_tower(slot: Dictionary, tower_type: String) -> bool:
	if slot.is_empty():
		return false
	var cost: int = TOWER_COSTS.get(tower_type, 50)
	if not GameState.spend_gold(cost):
		return false
	var tower: Node3D = TOWER_SCENE.instantiate()
	add_child(tower)
	tower.global_position = slot["position"] as Vector3
	tower.call("configure", tower_type)
	slot["tower"] = tower
	placed_towers.append(tower)
	return true

func get_nearest_tower_slot(world_pos: Vector3, max_range: float = 5.0) -> Dictionary:
	var best := {}
	var best_dist := INF
	for slot in tower_slots:
		if slot["tower"] == null:
			continue
		var dist: float = world_pos.distance_to(slot["position"] as Vector3)
		if dist < best_dist and dist <= max_range:
			best = slot
			best_dist = dist
	return best
