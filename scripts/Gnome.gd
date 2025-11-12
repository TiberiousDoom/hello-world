extends Character
class_name Gnome

var is_digging: bool = false
var dig_duration: float = 1.5
var can_dig_again: bool = true
var dig_cooldown: float = 3.0

func setup_character():
	character_type = "gnome"
	move_speed = 160.0
	can_climb_walls = false
	can_dig = true
	can_fly = false
	has_speed_boost = false
	character_color = Color(0.2, 0.6, 0.3)  # Green

func use_special_ability():
	"""Gnome can dig and craft - creates temporary passages"""
	if not can_dig_again:
		print("Digging on cooldown!")
		return

	if is_digging:
		return

	is_digging = true
	is_using_ability = true
	can_dig_again = false

	print("🔨 Gnome digging a passage!")

	# Slow down while digging
	var original_speed = move_speed
	move_speed = 50.0

	# Digging animation period
	await get_tree().create_timer(dig_duration).timeout

	# Check if character still exists
	if not is_inside_tree():
		return

	# Create a temporary passage (visual feedback)
	create_dig_passage()

	# Restore speed
	move_speed = original_speed
	is_digging = false
	is_using_ability = false

	# Cooldown
	await get_tree().create_timer(dig_cooldown).timeout

	# Check if character still exists
	if not is_inside_tree():
		return

	can_dig_again = true
	print("Gnome can dig again!")

func create_dig_passage():
	"""Creates a temporary passage or removes a small obstacle"""
	print("Passage created! Gnome can now access new areas.")
	# This could temporarily remove collision from obstacles
	# Or reveal hidden paths

func can_reach(target: Vector2) -> bool:
	"""Gnomes can dig to reach most places"""
	return true
