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

# Color for placeholder sprite
var character_color: Color = Color.WHITE

func _ready():
	target_position = position
	setup_character()

func _physics_process(delta):
	if is_moving:
		move_towards_target(delta)

func setup_character():
	"""Override this in child classes to set specific abilities"""
	pass

func move_towards_target(delta):
	"""Move the character towards the target position"""
	var direction = (target_position - position).normalized()
	var distance = position.distance_to(target_position)

	if distance > 5:
		velocity = direction * move_speed
		move_and_slide()
	else:
		position = target_position
		is_moving = false
		velocity = Vector2.ZERO

func set_target(new_target: Vector2):
	"""Set a new target position for the character to move to"""
	target_position = new_target
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
