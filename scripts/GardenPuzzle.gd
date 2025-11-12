extends Puzzle
class_name GardenPuzzle

# Magical Garden Puzzle: Use Fairy's magic sparkle to revive wilted plants
# Exclusive to: Fairy (requires magic ability)

var plants_needed: int = 3
var revived_plants: int = 0
var plant_objects: Array = []
var fairy_sparkle_used: bool = false

func _ready():
	super._ready()
	puzzle_name = "garden_plants"
	# Only Fairy can use magic sparkle
	preferred_characters = ["fairy"]
	allowed_characters = ["fairy"]  # ONLY Fairy can solve this
	show_hint_on_fail = true

	# Auto-register plants
	await get_tree().process_frame
	auto_register_plants()

func auto_register_plants():
	"""Automatically find and register plant objects"""
	if has_node("Plants"):
		var plants_node = $Plants
		for child in plants_node.get_children():
			if child is Interactive:
				plant_objects.append(child)
				child.interacted.connect(_on_plant_touched.bind(child))

func _on_plant_touched(character: Character, plant: Interactive):
	"""Called when character touches a plant"""
	if character.character_type != "fairy":
		print("<1 Only fairy magic can revive these plants!")
		return

	# Check if Fairy recently used sparkle ability
	if character.is_using_ability:
		# Fairy is actively using sparkle
		revived_plants += 1
		print("( Plant revived! (%d/%d)" % [revived_plants, plants_needed])

		# Visual feedback - make plant bloom
		plant.modulate = Color(0.5, 1.5, 0.5)  # Bright green glow

		# Check if all plants are revived
		if revived_plants >= plants_needed:
			# Automatically solve the puzzle
			attempt_solve(character)
	else:
		# Fairy touched without using sparkle
		print("=« Use your special ability (sparkle) to revive this plant!")

func check_solution(character: Character) -> bool:
	"""Puzzle solved when all plants are revived"""
	return revived_plants >= plants_needed

func on_solved(character: Character, time: float):
	"""When puzzle is completed"""
	print("<: All plants blooming! The garden is alive again!")
	print("( The Magic Gem has been revealed!")

	# Make all plants bloom brightly
	for plant in plant_objects:
		if plant:
			plant.modulate = Color(0.5, 2.0, 0.5)  # Very bright green

func get_hint(character: Character) -> String:
	"""Provide helpful hints"""
	if character.character_type != "fairy":
		return "Only the Fairy's magic can revive these wilted plants!"

	if revived_plants == 0:
		return "Press 'Use Ability' to activate sparkle, then touch the wilted plants! Revive all %d." % plants_needed
	elif revived_plants < plants_needed:
		return "Great! Revive %d more plant(s) with your sparkle!" % (plants_needed - revived_plants)
	else:
		return "All plants are blooming! The garden is restored!"

func on_puzzle_already_solved():
	"""Make all plants bloom if already solved"""
	revived_plants = plants_needed
	for plant in plant_objects:
		if plant:
			plant.modulate = Color(0.5, 2.0, 0.5)
