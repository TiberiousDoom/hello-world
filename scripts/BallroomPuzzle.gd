extends Puzzle
class_name BallroomPuzzle

# Ballroom Chandelier Puzzle: Reach high chandelier crystals to light them up
# Best for: Fairy (can fly) or Ant (can climb walls)

var crystals_needed: int = 3
var crystals_lit: int = 0
var crystal_objects: Array = []

func _ready():
	super._ready()
	puzzle_name = "ballroom_chandelier"
	# Only Fairy and Ant can reach the high crystals
	preferred_characters = ["fairy", "ant"]
	show_hint_on_fail = true

	# Auto-register crystals
	await get_tree().process_frame
	auto_register_crystals()

func auto_register_crystals():
	"""Automatically find and register crystal objects"""
	if has_node("Crystals"):
		var crystals_node = $Crystals
		for child in crystals_node.get_children():
			if child is Interactive:
				crystal_objects.append(child)
				child.interacted.connect(_on_crystal_lit.bind(child))

func _on_crystal_lit(character: Character, crystal: Interactive):
	"""Called when character lights up a crystal"""
	if not is_preferred_character(character):
		print("=¡ %s struggles to reach this high crystal! Try Fairy or Ant." % character.character_type.capitalize())
		return

	crystals_lit += 1
	print("( Crystal lit! (%d/%d)" % [crystals_lit, crystals_needed])

	# Visual feedback - make crystal glow
	crystal.modulate = Color(1.5, 1.5, 0.8)  # Bright golden glow

	# Check if all crystals are lit
	if crystals_lit >= crystals_needed:
		# Automatically solve the puzzle
		attempt_solve(character)

func check_solution(character: Character) -> bool:
	"""Puzzle solved when all crystals are lit"""
	return crystals_lit >= crystals_needed

func on_solved(character: Character, time: float):
	"""When puzzle is completed"""
	print("=Ž The chandelier shines brilliantly!")
	print("( The Crystal Chandelier piece is ready to be collected!")

	# Make all crystals shine brightly
	for crystal in crystal_objects:
		if crystal:
			crystal.modulate = Color(2.0, 2.0, 1.0)  # Very bright

func get_hint(character: Character) -> String:
	"""Provide helpful hints"""
	if not is_preferred_character(character):
		return "These crystals are too high! Try using a character that can fly or climb."

	if crystals_lit == 0:
		return "Click on the high crystals to light them up! You need to light all %d." % crystals_needed
	elif crystals_lit < crystals_needed:
		return "Good progress! Light %d more crystal(s)." % (crystals_needed - crystals_lit)
	else:
		return "All crystals are lit! The chandelier is complete!"

func on_puzzle_already_solved():
	"""Make all crystals glow if already solved"""
	crystals_lit = crystals_needed
	for crystal in crystal_objects:
		if crystal:
			crystal.modulate = Color(2.0, 2.0, 1.0)
