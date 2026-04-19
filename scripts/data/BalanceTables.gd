extends Node

func enemy_budget_for_wave(wave_number: int) -> int:
	return 6 + int(wave_number * 1.8)

func enemy_weights_for_wave(wave_number: int) -> Dictionary:
	var weights := {
		"basic": 0.55,
		"tank": 0.18,
		"runner": 0.12,
		"ranged": 0.12,
		"support": 0.03
	}
	if wave_number >= 3:
		weights["elite"] = 0.05
		weights["basic"] = 0.5
		weights["support"] = 0.05
	if wave_number >= 5:
		weights["boss"] = 0.04
		weights["basic"] = 0.38
	return _normalize(weights)

func enemy_stats(enemy_type: String, wave_number: int) -> Dictionary:
	var scale := 1.0 + (wave_number - 1) * 0.17
	match enemy_type:
		"tank":
			return {"health": 80.0 * scale, "speed": 2.0, "damage": 10.0 * scale, "xp": 35, "gold": 18}
		"runner":
			return {"health": 30.0 * scale, "speed": 4.6, "damage": 7.0 * scale, "xp": 20, "gold": 13}
		"ranged":
			return {"health": 38.0 * scale, "speed": 2.6, "damage": 8.0 * scale, "xp": 26, "gold": 15}
		"support":
			return {"health": 34.0 * scale, "speed": 2.7, "damage": 5.0 * scale, "xp": 24, "gold": 14}
		"elite":
			return {"health": 120.0 * scale, "speed": 2.4, "damage": 15.0 * scale, "xp": 65, "gold": 38}
		"boss":
			return {"health": 360.0 * scale, "speed": 1.7, "damage": 24.0 * scale, "xp": 200, "gold": 110}
		_:
			return {"health": 50.0 * scale, "speed": 3.0, "damage": 8.0 * scale, "xp": 24, "gold": 14}

func shop_items() -> Array[Dictionary]:
	return [
		{
			"id": "healing_potion",
			"name": "Healing Potion",
			"type": "consumable",
			"price": 35,
			"heal": 45.0
		},
		{
			"id": "mana_scroll",
			"name": "Mana Scroll",
			"type": "consumable",
			"price": 35,
			"mana": 35.0
		},
		{
			"id": "iron_blade",
			"name": "Iron Blade",
			"type": "equipment",
			"slot": "weapon",
			"price": 85,
			"stats": {"attack_damage": 6.0}
		},
		{
			"id": "guard_mail",
			"name": "Guard Mail",
			"type": "equipment",
			"slot": "armor",
			"price": 90,
			"stats": {"max_health": 25.0}
		},
		{
			"id": "swift_charm",
			"name": "Swift Charm",
			"type": "equipment",
			"slot": "trinket",
			"price": 100,
			"stats": {"attack_speed": 0.2}
		}
	]

func _normalize(weights: Dictionary) -> Dictionary:
	var total := 0.0
	for value in weights.values():
		total += float(value)
	if total <= 0.0:
		return {"basic": 1.0}
	for k in weights.keys():
		weights[k] = float(weights[k]) / total
	return weights
