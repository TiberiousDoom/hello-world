extends Puzzle
class_name ThroneRoomPuzzle

# Throne Room Final Puzzle: Place all collected items to restore palace magic
# Requires: ALL 7 collectible items

var required_items: Array[String] = [
	"golden_spoon",
	"glowing_book",
	"crystal_chandelier",
	"magic_gem",
	"ancient_key",
	"enchanted_crystal",
	"fairy_dust"
]

var throne_interactive: Interactive = null

func _ready():
	super._ready()
	puzzle_name = "throne_restoration"
	# Any character can complete the final restoration
	preferred_characters = []  # All equally worthy
	show_hint_on_fail = true
	required_item = ""  # We'll check multiple items ourselves

	# Find the throne interactive
	await get_tree().process_frame
	if has_node("ThroneInteractive"):
		throne_interactive = $ThroneInteractive
		throne_interactive.interacted.connect(_on_throne_activated)

func _on_throne_activated(character: Character):
	"""Called when character interacts with the throne"""
	# Check if all items are collected
	attempt_solve(character)

func check_solution(character: Character) -> bool:
	"""Puzzle solved when all 7 items are collected"""
	for item_name in required_items:
		if not GameManager.has_item(item_name):
			return false
	return true

func on_solved(character: Character, time: float):
	"""When puzzle is completed - the grand finale!"""
	print("=Q PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP =Q")
	print("<� CONGRATULATIONS! THE PALACE MAGIC IS RESTORED! <�")
	print("=Q PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP =Q")
	print("")
	print("( %s has restored all the magical treasures!" % character.character_type.capitalize())
	print("<� The Fairy Tale Palace shines with renewed enchantment!")
	print("")
	print("=� Game Statistics:")
	print("   - Puzzles Solved: %d/7" % GameManager.get_solved_puzzle_count())
	print("   - Items Collected: %d/7" % GameManager.get_collected_count())
	print("   - Total Time: %.1f seconds" % time)
	print("")
	print("<� Thank you for playing! <�")
	print("=Q PPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPPP =Q")

	# Visual celebration
	if throne_interactive:
		throne_interactive.modulate = Color(2.0, 2.0, 0.5)  # Golden glow

func get_hint(character: Character) -> String:
	"""Provide helpful hints"""
	var collected = 0
	var missing: Array[String] = []

	for item_name in required_items:
		if GameManager.has_item(item_name):
			collected += 1
		else:
			missing.append(item_name.replace("_", " ").capitalize())

	if collected == 0:
		return "The throne needs all 7 magical items to restore the palace. Explore all rooms and solve puzzles!"
	elif collected < required_items.size():
		return "You have %d/7 items. Still need: %s" % [collected, ", ".join(missing)]
	else:
		return "You have all 7 items! Touch the throne to restore the palace magic!"

func on_puzzle_already_solved():
	"""Throne glows if already solved"""
	if throne_interactive:
		throne_interactive.modulate = Color(2.0, 2.0, 0.5)

func _exit_tree():
	"""Clean up resources when puzzle is removed"""
	# Disconnect throne signal
	if throne_interactive and throne_interactive.interacted.is_connected(_on_throne_activated):
		throne_interactive.interacted.disconnect(_on_throne_activated)

	# Clear reference
	throne_interactive = null
