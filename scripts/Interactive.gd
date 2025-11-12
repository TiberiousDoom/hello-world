extends Area2D
class_name Interactive

# Base class for interactive objects like buttons, levers, etc.

signal interacted(character: Character)
signal activated
signal deactivated

@export var interaction_prompt: String = "Click to interact"
@export var requires_ability: String = ""  # e.g., "dig", "fly", "climb", "speed"
@export var is_active: bool = false
@export var can_toggle: bool = true
@export var one_time_use: bool = false

var nearby_character: Character = null
var has_been_used: bool = false
var hover_label: Label = null

func _ready():
	body_entered.connect(_on_body_entered)
	body_exited.connect(_on_body_exited)
	input_event.connect(_on_input_event)

	# Create hover label
	hover_label = Label.new()
	hover_label.text = interaction_prompt
	hover_label.modulate = Color(1, 1, 0)
	hover_label.position = Vector2(-50, -60)
	hover_label.visible = false
	add_child(hover_label)

func _on_body_entered(body):
	"""Character enters interaction area"""
	if body is Character:
		nearby_character = body
		show_prompt()

func _on_body_exited(body):
	"""Character leaves interaction area"""
	if body == nearby_character:
		nearby_character = null
		hide_prompt()

func _on_input_event(viewport, event, shape_idx):
	"""Handle click on interactive object"""
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if nearby_character:
			interact(nearby_character)

func can_interact(character: Character) -> bool:
	"""Check if character can interact with this object"""
	# Check if already used and one-time only
	if one_time_use and has_been_used:
		return false

	# Check ability requirement
	if requires_ability != "":
		match requires_ability:
			"dig":
				return character.can_dig
			"fly":
				return character.can_fly
			"climb":
				return character.can_climb_walls
			"speed":
				return character.has_speed_boost

	return true

func interact(character: Character):
	"""Attempt to interact with object"""
	if not can_interact(character):
		show_requirement_message(character)
		return

	# Mark as used
	if one_time_use:
		has_been_used = true

	# Toggle or activate
	if can_toggle:
		is_active = not is_active
		if is_active:
			on_activated(character)
			activated.emit()
		else:
			on_deactivated(character)
			deactivated.emit()
	else:
		is_active = true
		on_activated(character)
		activated.emit()

	# Emit interaction signal
	interacted.emit(character)

	print("%s interacted with %s" % [character.character_type, name])

func on_activated(character: Character):
	"""Override in child classes for activation behavior"""
	# Change visual appearance
	modulate = Color(0.5, 1, 0.5)  # Green tint

func on_deactivated(character: Character):
	"""Override in child classes for deactivation behavior"""
	# Restore appearance
	modulate = Color(1, 1, 1)

func show_prompt():
	"""Show interaction prompt"""
	if hover_label and nearby_character:
		if can_interact(nearby_character):
			hover_label.text = interaction_prompt
			hover_label.modulate = Color(1, 1, 0)  # Yellow
		else:
			hover_label.text = get_requirement_text()
			hover_label.modulate = Color(1, 0.5, 0.5)  # Red
		hover_label.visible = true

func hide_prompt():
	"""Hide interaction prompt"""
	if hover_label:
		hover_label.visible = false

func get_requirement_text() -> String:
	"""Get text explaining what's needed"""
	if one_time_use and has_been_used:
		return "Already used"

	if requires_ability != "":
		match requires_ability:
			"dig":
				return "Needs digging ability"
			"fly":
				return "Needs flight ability"
			"climb":
				return "Needs climbing ability"
			"speed":
				return "Needs speed ability"

	return "Cannot interact"

func show_requirement_message(character: Character):
	"""Show why character can't interact"""
	var message = get_requirement_text()
	print("❌ ", message)
