extends Puzzle
class_name KitchenPuzzle

# Kitchen Cooking Puzzle: Collect ingredients in any order, then use the stove

var ingredients_needed: Array[String] = ["flour", "water", "sugar"]
var ingredients_collected: Array[String] = []
var ingredients_spots: Dictionary = {}  # Track ingredient interactive objects

func _ready():
	super._ready()
	puzzle_name = "kitchen_cooking"
	# All characters can solve this puzzle
	preferred_characters = []  # All equally good
	show_hint_on_fail = true

	# Auto-register ingredients
	await get_tree().process_frame  # Wait for children to be ready
	auto_register_ingredients()

func auto_register_ingredients():
	"""Automatically find and register ingredient objects"""
	if has_node("Ingredients"):
		var ingredients_node = $Ingredients
		register_ingredient("flour", ingredients_node.get_node_or_null("Flour"))
		register_ingredient("water", ingredients_node.get_node_or_null("Water"))
		register_ingredient("sugar", ingredients_node.get_node_or_null("Sugar"))

	# Connect stove
	if has_node("StoveInteractive"):
		var stove = $StoveInteractive
		stove.interacted.connect(attempt_solve)

func register_ingredient(ingredient_name: String, interactive: Interactive):
	"""Register an ingredient interactive object"""
	if not interactive:
		return

	ingredients_spots[ingredient_name] = interactive
	interactive.interacted.connect(_on_ingredient_collected.bind(ingredient_name))

func _on_ingredient_collected(character: Character, ingredient: String):
	"""Called when character collects an ingredient"""
	if ingredient in ingredients_needed and not ingredient in ingredients_collected:
		ingredients_collected.append(ingredient)
		print("🥄 Collected ingredient: %s (%d/%d)" % [ingredient, ingredients_collected.size(), ingredients_needed.size()])

		# Visual feedback
		if ingredient in ingredients_spots:
			var spot = ingredients_spots[ingredient]
			spot.modulate = Color(0.5, 0.5, 0.5, 0.5)  # Grey out collected

		# Check if all ingredients collected
		if ingredients_collected.size() >= ingredients_needed.size():
			print("✅ All ingredients collected! Now use the stove to cook!")

func check_solution(character: Character) -> bool:
	"""Puzzle solved when all ingredients collected and stove used"""
	return ingredients_collected.size() >= ingredients_needed.size()

func on_solved(character: Character, time: float):
	"""When puzzle is completed"""
	print("🍳 Delicious! The magical recipe is complete!")
	print("✨ The Golden Spoon glows brighter!")

	# Make the golden spoon more visible or unlock it
	reveal_reward()

func reveal_reward():
	"""Show or unlock the golden spoon"""
	# The golden spoon is already in the room, but we can make it sparkle more
	var game = get_tree().get_first_node_in_group("game")
	if game:
		print("The Golden Spoon is now ready to be collected!")

func get_hint(character: Character) -> String:
	"""Provide helpful hints"""
	if ingredients_collected.size() == 0:
		return "Try collecting ingredients around the kitchen. Look for flour, water, and sugar!"
	elif ingredients_collected.size() < ingredients_needed.size():
		var remaining = []
		for ingredient in ingredients_needed:
			if not ingredient in ingredients_collected:
				remaining.append(ingredient)
		return "You still need: %s" % ", ".join(remaining)
	else:
		return "All ingredients collected! Use the stove to cook!"

func on_puzzle_already_solved():
	"""Hide ingredients if puzzle already solved"""
	for spot in ingredients_spots.values():
		if spot:
			spot.modulate = Color(0.5, 0.5, 0.5, 0.3)

func _exit_tree():
	"""Clean up resources when puzzle is removed"""
	# Disconnect ingredient signals
	for spot in ingredients_spots.values():
		if spot and spot.interacted.is_connected(_on_ingredient_collected):
			spot.interacted.disconnect(_on_ingredient_collected)

	# Disconnect stove signal
	if has_node("StoveInteractive"):
		var stove = $StoveInteractive
		if stove.interacted.is_connected(attempt_solve):
			stove.interacted.disconnect(attempt_solve)

	# Clear references
	ingredients_spots.clear()
	ingredients_collected.clear()
