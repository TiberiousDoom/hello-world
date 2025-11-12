extends Node

# Singleton for managing global game state

# Selected character
var selected_character: String = "ant"

# Collected items
var collected_items: Dictionary = {
	"golden_spoon": false,
	"glowing_book": false,
	"crystal_chandelier": false,
	"magic_gem": false,
	"ancient_key": false,
	"enchanted_crystal": false,
	"fairy_dust": false
}

# Current room
var current_room: String = "kitchen"

# Available rooms
var rooms: Array = [
	"kitchen",
	"cellar",
	"ballroom",
	"throne_room",
	"magical_garden",
	"library",
	"enchanted_tower"
]

# Solved puzzles
var solved_puzzles: Dictionary = {
	"kitchen_cooking": false,
	"cellar_digging": false,
	"ballroom_chandelier": false,
	"garden_plants": false,
	"library_books": false,
	"tower_speed": false,
	"throne_restoration": false
}

func reset_game():
	"""Reset all game progress"""
	selected_character = "ant"
	for item in collected_items:
		collected_items[item] = false
	for puzzle in solved_puzzles:
		solved_puzzles[puzzle] = false
	current_room = "kitchen"

func collect_item(item_name: String):
	"""Mark an item as collected"""
	if item_name in collected_items:
		collected_items[item_name] = true
		print("Collected: ", item_name)

func has_item(item_name: String) -> bool:
	"""Check if player has collected an item"""
	return collected_items.get(item_name, false)

func get_collected_count() -> int:
	"""Get number of items collected"""
	var count = 0
	for item in collected_items.values():
		if item:
			count += 1
	return count

func all_items_collected() -> bool:
	"""Check if all items have been collected"""
	for item in collected_items.values():
		if not item:
			return false
	return true

# Puzzle Management
func mark_puzzle_solved(puzzle_name: String):
	"""Mark a puzzle as solved"""
	if puzzle_name in solved_puzzles:
		solved_puzzles[puzzle_name] = true
		print("Puzzle solved: ", puzzle_name)

func mark_puzzle_unsolved(puzzle_name: String):
	"""Mark a puzzle as unsolved (for testing)"""
	if puzzle_name in solved_puzzles:
		solved_puzzles[puzzle_name] = false

func is_puzzle_solved(puzzle_name: String) -> bool:
	"""Check if a puzzle has been solved"""
	return solved_puzzles.get(puzzle_name, false)

func get_solved_puzzle_count() -> int:
	"""Get number of puzzles solved"""
	var count = 0
	for puzzle in solved_puzzles.values():
		if puzzle:
			count += 1
	return count

func all_puzzles_solved() -> bool:
	"""Check if all puzzles have been solved"""
	for puzzle in solved_puzzles.values():
		if not puzzle:
			return false
	return true
