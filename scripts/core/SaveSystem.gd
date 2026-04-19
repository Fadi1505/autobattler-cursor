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
	return true
