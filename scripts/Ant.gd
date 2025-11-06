extends Character
class_name Ant

func setup_character():
	character_type = "ant"
	move_speed = 180.0
	can_climb_walls = true
	can_dig = false  # Can access tiny tunnels instead
	can_fly = false
	has_speed_boost = false
	character_color = Color(0.6, 0.3, 0.1)  # Brown

func use_special_ability():
	"""Ant can climb walls"""
	print("Ant climbing wall!")
	# Wall climbing is handled by movement system

func can_reach(target: Vector2) -> bool:
	"""Ants can reach high places by climbing walls"""
	return true  # Ants can reach anywhere by climbing
