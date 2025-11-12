extends Camera2D

# Smooth camera that follows the player character

@export var follow_speed: float = 5.0
@export var look_ahead_distance: float = 30.0
@export var use_smoothing: bool = true

var target: Node2D = null

func _ready():
	# Enable smoothing
	position_smoothing_enabled = use_smoothing
	position_smoothing_speed = follow_speed

	# Make this camera active
	make_current()

func set_target(new_target: Node2D):
	"""Set the character to follow"""
	target = new_target

func _process(delta):
	if target:
		# Follow target with optional look-ahead
		var target_pos = target.global_position

		# Add look-ahead based on movement direction
		if target is Character and target.velocity.length() > 10:
			target_pos += target.velocity.normalized() * look_ahead_distance

		global_position = target_pos

func set_limits(left: int, top: int, right: int, bottom: int):
	"""Set camera bounds for current room"""
	limit_left = left
	limit_top = top
	limit_right = right
	limit_bottom = bottom
