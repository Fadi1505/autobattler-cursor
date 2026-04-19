extends Control

signal build_requested(tower_type: String)
signal upgrade_requested()

@onready var build_panel: VBoxContainer = $Panel/Margin/VBox/BuildOptions
@onready var upgrade_button: Button = $Panel/Margin/VBox/UpgradeButton
@onready var close_button: Button = $Panel/Margin/VBox/Close
@onready var message_label: Label = $Panel/Margin/VBox/Message

const TOWER_COSTS := {
	"archer": 50,
	"slow": 65,
	"cannon": 85
}
const TOWER_LABELS := {
	"archer": "Archer Tower",
	"slow": "Slow Tower",
	"cannon": "Cannon Tower"
}

var _mode := "build"

func _ready() -> void:
	visible = false
	close_button.pressed.connect(func() -> void: visible = false)
	upgrade_button.pressed.connect(func() -> void: upgrade_requested.emit())

func open_build() -> void:
	_mode = "build"
	visible = true
	upgrade_button.visible = false
	message_label.text = ""
	_rebuild_options()

func open_upgrade(tower: Node3D) -> void:
	_mode = "upgrade"
	visible = true
	for child in build_panel.get_children():
		child.queue_free()
	if tower.has_method("get_upgrade_cost"):
		var cost: int = tower.get_upgrade_cost()
		upgrade_button.text = "Upgrade Tier %d (%dg)" % [tower.tier + 1, cost]
		upgrade_button.visible = tower.tier < 3
		upgrade_button.disabled = GameState.gold < cost
	else:
		upgrade_button.visible = false
	message_label.text = "%s Tier %d" % [tower.tower_type.capitalize(), tower.tier]

func _rebuild_options() -> void:
	for child in build_panel.get_children():
		child.queue_free()
	for type_name in TOWER_COSTS.keys():
		var cost: int = TOWER_COSTS[type_name]
		var button := Button.new()
		button.text = "%s (%dg)" % [TOWER_LABELS[type_name], cost]
		button.disabled = GameState.gold < cost
		var tn := type_name
		button.pressed.connect(func() -> void:
			build_requested.emit(tn)
			visible = false
		)
		build_panel.add_child(button)
