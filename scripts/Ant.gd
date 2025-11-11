extends Character
class_name Ant

var is_climbing: bool = false
var climb_speed: float = 150.0
var wall_check_distance: float = 40.0

func setup_character():
	character_type = "ant"
	move_speed = 180.0
	can_climb_walls = true
	can_dig = false  # Can access tiny tunnels instead
	can_fly = false
	has_speed_boost = false
	character_color = Color(0.6, 0.3, 0.1)  # Brown

func use_special_ability():
	"""Ant can toggle climbing mode"""
	is_climbing = not is_climbing
	is_using_ability = is_climbing

	if is_climbing:
		print("Ant entering climb mode - can now scale walls!")
		# Set collision layer to allow passing through some obstacles
		collision_mask = 1  # Only collide with walls
	else:
		print("Ant exiting climb mode")
		collision_mask = 1

func _physics_process(delta):
	# Override movement when climbing
	if is_climbing and is_moving:
		climb_towards_target(delta)
	else:
		super._physics_process(delta)

func climb_towards_target(delta):
	"""Special climbing movement - can move on walls"""
	var direction = (target_position - global_position).normalized()

	# When climbing, ant can move in any direction including up
	velocity = direction * climb_speed
	move_and_slide()

	# Check if reached target
	if global_position.distance_to(target_position) < 10:
		is_moving = false
		velocity = Vector2.ZERO

func can_reach(target: Vector2) -> bool:
	"""Ants can reach anywhere by climbing walls"""
	return true
