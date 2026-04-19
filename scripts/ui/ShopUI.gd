extends Control

@onready var item_list: VBoxContainer = $Panel/Margin/VBox/Items
@onready var close_button: Button = $Panel/Margin/VBox/Close
@onready var message_label: Label = $Panel/Margin/VBox/Message

func _ready() -> void:
	visible = false
	close_button.pressed.connect(func() -> void: visible = false)
	_build_items()

func _build_items() -> void:
	for child in item_list.get_children():
		child.queue_free()

	for item in BalanceTables.shop_items():
		var button := Button.new()
		button.text = "%s (%dg)" % [item["name"], int(item["price"])]
		button.pressed.connect(func() -> void: _buy_item(item))
		item_list.add_child(button)

func _buy_item(item: Dictionary) -> void:
	if not GameState.spend_gold(int(item["price"])):
		message_label.text = "Not enough gold."
		return
	if item.get("type", "") == "consumable":
		if item.has("heal"):
			GameState.heal(float(item["heal"]))
		if item.has("mana"):
			GameState.restore_mana(float(item["mana"]))
	else:
		GameState.add_item(item)
		GameState.equip_item(item)
	message_label.text = "Purchased %s" % item["name"]
