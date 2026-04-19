extends Control

@onready var items_container: VBoxContainer = $Panel/Margin/VBox/Items
@onready var close_button: Button = $Panel/Margin/VBox/Close
@onready var gold_label: Label = $Panel/Margin/VBox/GoldRow/GoldAmount
@onready var message_label: Label = $Panel/Margin/VBox/Message

const TRAIT_LABELS := {
	"max_health": "Max Health",
	"max_mana": "Max Mana",
	"attack_damage": "Attack Damage"
}

func _ready() -> void:
	visible = false
	close_button.pressed.connect(func() -> void: visible = false)
	GameState.gold_changed.connect(_on_gold_changed)

func open() -> void:
	visible = true
	_rebuild()

func _on_gold_changed(_amount: int) -> void:
	if visible:
		_rebuild()

func _rebuild() -> void:
	for child in items_container.get_children():
		child.queue_free()
	gold_label.text = "%d" % GameState.gold
	message_label.text = ""

	for trait_name in TRAIT_LABELS.keys():
		var row := HBoxContainer.new()
		row.add_theme_constant_override("separation", 12)

		var label := Label.new()
		var lvl := int(MetaProgression.trait_levels.get(trait_name, 0))
		var cap := MetaProgression.TRAIT_CAP
		label.text = "%s  Lv %d/%d" % [TRAIT_LABELS[trait_name], lvl, cap]
		label.size_flags_horizontal = Control.SIZE_EXPAND_FILL
		row.add_child(label)

		var bonus_label := Label.new()
		bonus_label.text = "+%.1f" % MetaProgression.get_starting_bonus(trait_name)
		row.add_child(bonus_label)

		var button := Button.new()
		if MetaProgression.can_upgrade(trait_name):
			var cost := MetaProgression.upgrade_cost(trait_name)
			button.text = "Upgrade (%dg)" % cost
			var tn := trait_name
			button.pressed.connect(func() -> void: _buy_upgrade(tn))
			button.disabled = GameState.gold < cost
		else:
			button.text = "MAX"
			button.disabled = true
		row.add_child(button)
		items_container.add_child(row)

func _buy_upgrade(trait_name: String) -> void:
	if MetaProgression.upgrade_trait(trait_name):
		message_label.text = "Upgraded %s!" % TRAIT_LABELS[trait_name]
		_rebuild()
	else:
		message_label.text = "Not enough gold."
