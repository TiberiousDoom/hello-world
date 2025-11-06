extends Character
class_name Gnome

func setup_character():
	character_type = "gnome"
	move_speed = 160.0
	can_climb_walls = false
	can_dig = true
	can_fly = false
	has_speed_boost = false
	character_color = Color(0.2, 0.6, 0.3)  # Green

func use_special_ability():
	"""Gnome can dig and craft tools"""
	print("Gnome digging!")
	# Digging will create passages

func can_reach(target: Vector2) -> bool:
	"""Gnomes can dig to reach places"""
	return true  # Can dig paths to most places
