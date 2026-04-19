extends Area3D

@onready var prompt: Label3D = $Prompt
var hero_in_range := false
var world_ui: CanvasLayer

func _ready() -> void:
	prompt.visible = false
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	world_ui = get_tree().get_first_node_in_group("world_ui")

func _process(_delta: float) -> void:
	if hero_in_range and Input.is_action_just_pressed("interact"):
		if world_ui == null:
			world_ui = get_tree().get_first_node_in_group("world_ui")
		if world_ui != null:
			world_ui.call("open_shop")

func _on_body_entered(body: Node) -> void:
	if body.name == "Hero":
		hero_in_range = true
		prompt.visible = true

func _on_body_exited(body: Node) -> void:
	if body.name == "Hero":
		hero_in_range = false
		prompt.visible = false
