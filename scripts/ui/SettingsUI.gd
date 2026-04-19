extends Control

@onready var master_slider: HSlider = $Panel/Margin/VBox/MasterRow/Slider
@onready var sfx_slider: HSlider = $Panel/Margin/VBox/SFXRow/Slider
@onready var music_slider: HSlider = $Panel/Margin/VBox/MusicRow/Slider
@onready var close_button: Button = $Panel/Margin/VBox/Close
@onready var apply_button: Button = $Panel/Margin/VBox/Apply

const BUS_NAMES := ["Master", "SFX", "Music"]

func _ready() -> void:
	visible = false
	close_button.pressed.connect(func() -> void: visible = false)
	apply_button.pressed.connect(_on_apply)
	_ensure_buses()

func open() -> void:
	visible = true
	master_slider.value = ProfileData.settings.get("master_volume", 0.8)
	sfx_slider.value = ProfileData.settings.get("sfx_volume", 0.9)
	music_slider.value = ProfileData.settings.get("music_volume", 0.65)

func _ensure_buses() -> void:
	for bus_name in BUS_NAMES:
		var idx := AudioServer.get_bus_index(bus_name)
		if idx == -1:
			continue
		var setting_key := bus_name.to_lower() + "_volume"
		var vol: float = float(ProfileData.settings.get(setting_key, 0.8))
		AudioServer.set_bus_volume_db(idx, linear_to_db(vol))

func _on_apply() -> void:
	ProfileData.settings["master_volume"] = master_slider.value
	ProfileData.settings["sfx_volume"] = sfx_slider.value
	ProfileData.settings["music_volume"] = music_slider.value
	_apply_audio()
	SaveSystem.save_profile()

func _apply_audio() -> void:
	_set_bus_volume("Master", ProfileData.settings["master_volume"])
	_set_bus_volume("SFX", ProfileData.settings["sfx_volume"])
	_set_bus_volume("Music", ProfileData.settings["music_volume"])

func _set_bus_volume(bus_name: String, linear_vol: float) -> void:
	var idx := AudioServer.get_bus_index(bus_name)
	if idx == -1:
		return
	AudioServer.set_bus_volume_db(idx, linear_to_db(linear_vol))
