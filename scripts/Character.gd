extends CharacterBody2D
class_name Character

# Base character class for all playable characters

@export var move_speed: float = 200.0
@export var character_type: String = "ant"

var target_position: Vector2
var is_moving: bool = false
var can_climb_walls: bool = false
var can_fly: bool = false
var can_dig: bool = false
var has_speed_boost: bool = false
var is_using_ability: bool = false

# Navigation
var nav_agent: NavigationAgent2D

# Animation
var facing_direction: Vector2 = Vector2.RIGHT

# Color for placeholder sprite
var character_color: Color = Color.WHITE

func _ready():
	target_position = position
	setup_navigation()
	setup_character()

func setup_navigation():
	"""Set up navigation agent for pathfinding"""
	nav_agent = NavigationAgent2D.new()
	add_child(nav_agent)
	nav_agent.path_desired_distance = 4.0
	nav_agent.target_desired_distance = 10.0
	nav_agent.avoidance_enabled = true
	# Wait for navigation to be ready
	call_deferred("_navigation_ready")

func _navigation_ready():
	"""Called when navigation is ready"""
	await get_tree().physics_frame

func _physics_process(delta):
	if is_moving:
		move_towards_target(delta)

func setup_character():
	"""Override this in child classes to set specific abilities"""
	pass

func move_towards_target(delta):
	"""Move the character towards the target position using navigation"""
	if nav_agent.is_navigation_finished():
		is_moving = false
		velocity = Vector2.ZERO
		return

	var next_position = nav_agent.get_next_path_position()
	var direction = (next_position - global_position).normalized()

	# Update facing direction
	if direction.length() > 0.1:
		facing_direction = direction

	velocity = direction * move_speed
	move_and_slide()

func set_target(new_target: Vector2):
	"""Set a new target position for the character to move to"""
	target_position = new_target
	if nav_agent:
		nav_agent.target_position = new_target
	is_moving = true

func can_reach(target: Vector2) -> bool:
	"""Check if the character can reach a specific position"""
	# Base implementation - can be overridden by specific characters
	return true

func use_special_ability():
	"""Use the character's special ability"""
	# Override in child classes
	pass

func get_character_info() -> Dictionary:
	"""Return character information"""
	return {
		"type": character_type,
		"can_climb": can_climb_walls,
		"can_fly": can_fly,
		"can_dig": can_dig,
		"has_speed": has_speed_boost
	}
