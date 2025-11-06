extends Character
class_name Weasel

func setup_character():
	character_type = "weasel"
	move_speed = 300.0  # Fastest character!
	can_climb_walls = false
	can_dig = true  # Can burrow
	can_fly = false
	has_speed_boost = true
	character_color = Color(0.8, 0.7, 0.5)  # Light brown/tan

func use_special_ability():
	"""Weasel can use super speed"""
	print("Weasel using speed boost!")
	move_speed = 450.0
	# Speed boost could have a timer
	await get_tree().create_timer(2.0).timeout
	move_speed = 300.0

func can_reach(target: Vector2) -> bool:
	"""Weasels can burrow and squeeze through tight spaces"""
	return true
