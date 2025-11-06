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

func reset_game():
	"""Reset all game progress"""
	selected_character = "ant"
	for item in collected_items:
		collected_items[item] = false
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
