extends Character
class_name Fairy

var is_flying: bool = true  # Fairies fly by default!
var flight_height_offset: float = -20.0  # Hovers slightly above ground
var hover_amplitude: float = 5.0
var hover_speed: float = 2.0
var time_passed: float = 0.0

func setup_character():
	character_type = "fairy"
	move_speed = 220.0
	can_climb_walls = false
	can_dig = false
	can_fly = true
	has_speed_boost = false
	character_color = Color(1.0, 0.8, 1.0)  # Light pink/purple

	# Fairies ignore ground collision, they fly over obstacles
	collision_mask = 1  # Still collide with walls

func use_special_ability():
	"""Fairy can use magic - creates a sparkle effect and reveals hidden items"""
	is_using_ability = true
	print("✨ Fairy using magic sparkle!")

	# Create a magic effect (simple visual feedback for now)
	create_magic_sparkle()

	# Reset ability state after a moment
	await get_tree().create_timer(0.5).timeout
	is_using_ability = false

func create_magic_sparkle():
	"""Visual feedback for magic ability"""
	# This could reveal hidden items or solve puzzles
	print("Magic sparkles around the fairy!")

func _physics_process(delta):
	# Add gentle hovering motion
	time_passed += delta
	var hover_offset = sin(time_passed * hover_speed) * hover_amplitude

	super._physics_process(delta)

	# Apply hover visual offset (doesn't affect collision)
	if has_node("Sprite"):
		$Sprite.position.y = flight_height_offset + hover_offset
	if has_node("Label"):
		$Label.position.y = -40 + hover_offset

func can_reach(target: Vector2) -> bool:
	"""Fairies can fly anywhere"""
	return true
