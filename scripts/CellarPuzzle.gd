extends Puzzle
class_name CellarPuzzle

# Cellar Digging Puzzle: Dig through dirt piles to find hidden treasures
# Best for: Gnome (master digger) or Ant (can access tunnels)

var dig_spots_needed: int = 3
var dug_spots: int = 0
var dig_spot_objects: Array = []

func _ready():
	super._ready()
	puzzle_name = "cellar_digging"
	# Gnome and Ant are best for digging
	preferred_characters = ["gnome", "ant"]
	show_hint_on_fail = true

	# Auto-register dig spots
	await get_tree().process_frame
	auto_register_dig_spots()

func auto_register_dig_spots():
	"""Automatically find and register dig spot objects"""
	if has_node("DigSpots"):
		var dig_spots_node = $DigSpots
		for child in dig_spots_node.get_children():
			if child is Interactive:
				dig_spot_objects.append(child)
				child.interacted.connect(_on_spot_dug.bind(child))

func _on_spot_dug(character: Character, dig_spot: Interactive):
	"""Called when character digs a spot"""
	if not is_preferred_character(character):
		print(">� %s can't dig through this hard dirt! Try Gnome or Ant." % character.character_type.capitalize())
		return

	dug_spots += 1
	print("� Dug spot! (%d/%d)" % [dug_spots, dig_spots_needed])

	# Visual feedback - fade out the dirt pile
	dig_spot.modulate = Color(0.5, 0.4, 0.3, 0.3)  # Faded dirt

	# Check if all spots are dug
	if dug_spots >= dig_spots_needed:
		# Automatically solve the puzzle
		attempt_solve(character)

func check_solution(character: Character) -> bool:
	"""Puzzle solved when all dig spots are cleared"""
	return dug_spots >= dig_spots_needed

func on_solved(character: Character, time: float):
	"""When puzzle is completed"""
	print("� All dirt cleared! You've uncovered the passage!")
	print("( The Ancient Key has been revealed!")

	# Make all dig spots completely transparent
	for spot in dig_spot_objects:
		if spot:
			spot.modulate = Color(1, 1, 1, 0)  # Invisible

func get_hint(character: Character) -> String:
	"""Provide helpful hints"""
	if not is_preferred_character(character):
		return "This dirt is too hard to dig! Try using a character with digging ability."

	if dug_spots == 0:
		return "Dig through the dirt piles to clear the path! There are %d spots to dig." % dig_spots_needed
	elif dug_spots < dig_spots_needed:
		return "Keep digging! %d more spot(s) to go." % (dig_spots_needed - dug_spots)
	else:
		return "All dirt cleared! The path is open!"

func on_puzzle_already_solved():
	"""Make all dig spots invisible if already solved"""
	dug_spots = dig_spots_needed
	for spot in dig_spot_objects:
		if spot:
			spot.modulate = Color(1, 1, 1, 0)

func _exit_tree():
	"""Clean up resources when puzzle is removed"""
	# Disconnect all dig spot signals
	for spot in dig_spot_objects:
		if spot and spot.interacted.is_connected(_on_spot_dug):
			spot.interacted.disconnect(_on_spot_dug)

	# Clear references
	dig_spot_objects.clear()
