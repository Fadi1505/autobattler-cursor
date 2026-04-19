extends Control

@onready var label: Label = $Panel/Margin/VBox/Items
@onready var close_button: Button = $Panel/Margin/VBox/Close

func _ready() -> void:
	visible = false
	close_button.pressed.connect(func() -> void: visible = false)

func refresh_inventory(items: Array) -> void:
	if items.is_empty():
		label.text = "Inventory empty"
		return
	var lines: Array[String] = []
	for item in items:
		var line := "- %s" % item.get("name", "Unknown")
		if item.has("stats"):
			line += " %s" % str(item["stats"])
		lines.append(line)
	label.text = "\n".join(lines)
