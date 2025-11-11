extends Character
class_name Weasel

var normal_speed: float = 300.0
var boost_speed: float = 500.0
var boost_duration: float = 3.0
var boost_cooldown: float = 5.0
var can_boost: bool = true
var is_boosting: bool = false

func setup_character():
	character_type = "weasel"
	move_speed = normal_speed
	can_climb_walls = false
	can_dig = true  # Can burrow
	can_fly = false
	has_speed_boost = true
	character_color = Color(0.8, 0.7, 0.5)  # Light brown/tan

func use_special_ability():
	"""Weasel can activate super speed boost"""
	if not can_boost:
		print("Speed boost on cooldown!")
		return

	if is_boosting:
		return

	activate_speed_boost()

func activate_speed_boost():
	"""Activate temporary speed boost"""
	can_boost = false
	is_boosting = true
	is_using_ability = true
	move_speed = boost_speed

	print("💨 Weasel SPEED BOOST activated!")

	# Show visual feedback (speed lines, etc could be added here)
	modulate = Color(1.5, 1.5, 1.5)  # Brighter when boosting

	# Duration of boost
	await get_tree().create_timer(boost_duration).timeout

	# End boost
	move_speed = normal_speed
	is_boosting = false
	is_using_ability = false
	modulate = Color(1.0, 1.0, 1.0)  # Back to normal
	print("Speed boost ended")

	# Cooldown period
	await get_tree().create_timer(boost_cooldown).timeout
	can_boost = true
	print("Speed boost ready!")

func can_reach(target: Vector2) -> bool:
	"""Weasels can burrow and use speed to reach anywhere"""
	return true
