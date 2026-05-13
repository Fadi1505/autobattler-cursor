extends Node

const SAVE_PATH := "user://profile.save"

func save_profile() -> bool:
	var file := FileAccess.open(SAVE_PATH, FileAccess.WRITE)
	if file == null:
		return false
	file.store_string(JSON.stringify(ProfileData.to_dict()))
	file.close()
	return true

func load_profile() -> bool:
	if not FileAccess.file_exists(SAVE_PATH):
		return false
	var file := FileAccess.open(SAVE_PATH, FileAccess.READ)
	if file == null:
		return false
	var content: String = file.get_as_text()
	file.close()
	var parsed: Variant = JSON.parse_string(content)
	if typeof(parsed) != TYPE_DICTIONARY:
		return false
	ProfileData.from_dict(parsed as Dictionary)
	MetaProgression.set_trait_levels(ProfileData.meta_traits.duplicate(true))
	apply_keybinds()
	return true

# Push ProfileData.keybinds into Godot's InputMap. Skips actions that don't exist
# in the project so a malformed save can't poison input.
# Expected format: { action_name: [ {"type": "key", "code": <keycode>}, {"type": "mouse", "code": <button_index>} ] }
func apply_keybinds() -> void:
	for action_variant in ProfileData.keybinds.keys():
		var action: String = str(action_variant)
		if not InputMap.has_action(action):
			continue
		var entries: Variant = ProfileData.keybinds[action]
		if typeof(entries) != TYPE_ARRAY:
			continue
		InputMap.action_erase_events(action)
		for entry_variant in (entries as Array):
			if typeof(entry_variant) != TYPE_DICTIONARY:
				continue
			var entry: Dictionary = entry_variant as Dictionary
			var event := _event_from_dict(entry)
			if event != null:
				InputMap.action_add_event(action, event)

# Snapshot the current InputMap into ProfileData.keybinds for the actions that
# are exposed to remapping (everything except internal Godot ui_* actions).
func capture_keybinds() -> void:
	var snapshot: Dictionary = {}
	for action_variant in InputMap.get_actions():
		var action: String = str(action_variant)
		if action.begins_with("ui_"):
			continue
		var entries: Array = []
		for event in InputMap.action_get_events(action):
			var entry := _event_to_dict(event)
			if not entry.is_empty():
				entries.append(entry)
		snapshot[action] = entries
	ProfileData.keybinds = snapshot

func _event_from_dict(entry: Dictionary) -> InputEvent:
	var entry_type: String = str(entry.get("type", ""))
	var code: int = int(entry.get("code", 0))
	match entry_type:
		"key":
			var key_event := InputEventKey.new()
			key_event.keycode = code
			return key_event
		"mouse":
			var mouse_event := InputEventMouseButton.new()
			mouse_event.button_index = code
			return mouse_event
		"joy_button":
			var joy_event := InputEventJoypadButton.new()
			joy_event.button_index = code
			return joy_event
	return null

func _event_to_dict(event: InputEvent) -> Dictionary:
	if event is InputEventKey:
		return {"type": "key", "code": int((event as InputEventKey).keycode)}
	if event is InputEventMouseButton:
		return {"type": "mouse", "code": int((event as InputEventMouseButton).button_index)}
	if event is InputEventJoypadButton:
		return {"type": "joy_button", "code": int((event as InputEventJoypadButton).button_index)}
	return {}
