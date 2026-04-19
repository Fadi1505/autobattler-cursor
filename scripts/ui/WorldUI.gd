extends CanvasLayer

@onready var status_label: Label = $Margin/HUD/Panel/PanelMargin/VBox/Status
@onready var level_label: Label = $Margin/HUD/Panel/PanelMargin/VBox/StatsRow/Level
@onready var xp_label: Label = $Margin/HUD/Panel/PanelMargin/VBox/StatsRow/XP
@onready var gold_label: Label = $Margin/HUD/Panel/PanelMargin/VBox/StatsRow/Gold
@onready var health_label: Label = $Margin/HUD/Panel/PanelMargin/VBox/StatsRow/Health
@onready var mana_label: Label = $Margin/HUD/Panel/PanelMargin/VBox/StatsRow/Mana
@onready var town_hp_label: Label = $Margin/HUD/Panel/PanelMargin/VBox/StatsRow/TownHP
@onready var wave_label: Label = $Margin/HUD/Panel/PanelMargin/VBox/WaveRow/Wave
@onready var start_wave_button: Button = $Margin/HUD/Panel/PanelMargin/VBox/ControlsRow/StartWave
@onready var inventory_button: Button = $Margin/HUD/Panel/PanelMargin/VBox/ControlsRow/Inventory
@onready var controls_button: Button = $Margin/HUD/Panel/PanelMargin/VBox/ControlsRow/Controls
@onready var shop_ui: Control = $ShopUI
@onready var inventory_ui: Control = $InventoryUI
@onready var controls_panel: Panel = $ControlsPanel
@onready var run_over_panel: Panel = $RunOverPanel
@onready var run_over_title: Label = $RunOverPanel/Margin/VBox/RunOverTitle
@onready var run_over_restart: Button = $RunOverPanel/Margin/VBox/RunOverRestart

func _ready() -> void:
	start_wave_button.pressed.connect(_on_start_wave)
	inventory_button.pressed.connect(_on_toggle_inventory)
	controls_button.pressed.connect(_on_toggle_controls)
	if controls_panel != null and controls_panel.has_node("Margin/VBox/Close"):
		controls_panel.get_node("Margin/VBox/Close").pressed.connect(_on_close_controls)
	if run_over_restart != null:
		run_over_restart.pressed.connect(_on_run_over_restart)
	GameState.gold_changed.connect(_on_gold_changed)
	GameState.level_changed.connect(set_level_text)
	GameState.xp_changed.connect(_on_xp_changed)
	GameState.hero_stats_changed.connect(_on_stats_changed)
	GameState.inventory_changed.connect(_on_inventory_changed)
	_on_gold_changed(GameState.gold)
	set_level_text(GameState.level)
	_on_xp_changed(GameState.xp, GameState.required_xp_for_level(GameState.level))
	_on_stats_changed(GameState.hero_stats.duplicate(true))
	_on_inventory_changed(GameState.inventory)
	set_status_text("WASD move · LMB attack · Q/R/F/G skills · Tab lock · E shop · I inv")

func set_status_text(text: String) -> void:
	status_label.text = text

func set_level_text(level: int) -> void:
	level_label.text = "Lvl %d" % level

func _on_gold_changed(amount: int) -> void:
	gold_label.text = "Gold: %d" % amount

func _on_xp_changed(current: int, needed: int) -> void:
	xp_label.text = "XP: %d / %d" % [current, needed]

func _on_stats_changed(stats: Dictionary) -> void:
	health_label.text = "HP: %d / %d" % [int(stats["health"]), int(stats["max_health"])]
	mana_label.text = "Mana: %d / %d" % [int(stats["mana"]), int(stats["max_mana"])]

func set_town_health(current: float, maximum: float) -> void:
	if town_hp_label != null:
		town_hp_label.text = "Town: %d / %d" % [int(current), int(maximum)]

func set_wave_number(wave: int, is_boss: bool = false) -> void:
	if wave_label != null:
		wave_label.text = "Wave %d" % wave if not is_boss else "Wave %d (Boss!)" % wave

func _on_start_wave() -> void:
	if not WaveDirector.wave_active:
		WaveDirector.start_next_wave()

func _on_toggle_inventory() -> void:
	inventory_ui.visible = not inventory_ui.visible

func _on_toggle_controls() -> void:
	if controls_panel != null:
		controls_panel.visible = not controls_panel.visible

func _on_close_controls() -> void:
	if controls_panel != null:
		controls_panel.visible = false

func show_run_over(victory: bool) -> void:
	if run_over_panel != null and run_over_title != null:
		run_over_title.text = "Victory!" if victory else "Defeat"
		run_over_panel.visible = true

func _on_run_over_restart() -> void:
	if run_over_panel != null:
		run_over_panel.visible = false
	GameState.reset_run()
	get_tree().reload_current_scene()

func open_shop() -> void:
	shop_ui.visible = true

func close_shop() -> void:
	shop_ui.visible = false

func _unhandled_input(event: InputEvent) -> void:
	if event.is_action_pressed("open_inventory"):
		_on_toggle_inventory()

func _on_inventory_changed(items: Array) -> void:
	inventory_ui.call("refresh_inventory", items)
