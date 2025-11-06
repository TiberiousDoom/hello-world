extends Character
class_name Fairy

func setup_character():
	character_type = "fairy"
	move_speed = 220.0
	can_climb_walls = false
	can_dig = false
	can_fly = true
	has_speed_boost = false
	character_color = Color(1.0, 0.8, 1.0)  # Light pink/purple

func use_special_ability():
	"""Fairy can use magic to solve puzzles"""
	print("Fairy using magic!")
	# Magic abilities will be context-specific

func can_reach(target: Vector2) -> bool:
	"""Fairies can fly to reach high places"""
	return true  # Fairies can fly anywhere
