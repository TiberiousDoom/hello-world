extends Node2D

# Main game controller

var current_character: Character = null
var current_room: Node2D = null
var room_index: int = 0

# Preload character scenes
var character_scenes = {
	"ant": preload("res://characters/Ant.tscn"),
	"fairy": preload("res://characters/Fairy.tscn"),
	"gnome": preload("res://characters/Gnome.tscn"),
	"weasel": preload("res://characters/Weasel.tscn")
}

# Preload room scenes
var room_scenes = {
	"kitchen": preload("res://rooms/Kitchen.tscn"),
	"cellar": preload("res://rooms/Cellar.tscn"),
	"ballroom": preload("res://rooms/Ballroom.tscn"),
	"throne_room": preload("res://rooms/ThroneRoom.tscn"),
	"magical_garden": preload("res://rooms/MagicalGarden.tscn"),
	"library": preload("res://rooms/Library.tscn"),
	"enchanted_tower": preload("res://rooms/EnchantedTower.tscn")
}

var room_order = [
	"kitchen",
	"cellar",
	"ballroom",
	"magical_garden",
	"library",
	"enchanted_tower",
	"throne_room"
]

func _ready():
	spawn_character()
	load_room("kitchen")
	update_ui()

func spawn_character():
	"""Spawn the selected character"""
	var char_type = GameManager.selected_character

	if char_type in character_scenes:
		current_character = character_scenes[char_type].instantiate()
		add_child(current_character)
		current_character.position = Vector2(200, 500)
		current_character.add_to_group("player")

		# Set camera to follow character
		var camera = $Camera2D
		if camera and camera.has_method("set_target"):
			camera.set_target(current_character)

		print("Spawned character: ", char_type)

func load_room(room_name: String):
	"""Load a room scene"""
	# Remove current room if exists
	if current_room:
		current_room.queue_free()

	# Load new room
	if room_name in room_scenes:
		current_room = room_scenes[room_name].instantiate()
		$RoomContainer.add_child(current_room)
		GameManager.current_room = room_name
		update_ui()
		print("Loaded room: ", room_name)

func _unhandled_input(event):
	"""Handle tap-to-move input (only if not handled by UI)"""
	if event is InputEventMouseButton and event.pressed and event.button_index == MOUSE_BUTTON_LEFT:
		if current_character:
			# Get click position in world space
			var click_pos = get_global_mouse_position()
			current_character.set_target(click_pos)

func update_ui():
	"""Update the HUD display"""
	# Update character name
	var char_label = $UI/HUD/TopBar/CharacterLabel
	if char_label:
		char_label.text = "Character: " + GameManager.selected_character.capitalize()

	# Update items collected
	var items_label = $UI/HUD/TopBar/ItemsLabel
	if items_label:
		var collected = GameManager.get_collected_count()
		items_label.text = "Items: %d/7" % collected

	# Update room name
	var room_label = $UI/HUD/BottomBar/RoomLabel
	if room_label:
		room_label.text = GameManager.current_room.replace("_", " ").capitalize()

func _on_menu_button_pressed():
	"""Return to main menu"""
	get_tree().change_scene_to_file("res://scenes/MainMenu.tscn")

func _on_ability_button_pressed():
	"""Use character's special ability"""
	if current_character:
		current_character.use_special_ability()

func _on_next_room_button_pressed():
	"""Move to next room"""
	room_index = (room_index + 1) % room_order.size()
	load_room(room_order[room_index])

	# Reposition character at entrance of new room
	if current_character:
		current_character.position = Vector2(200, 500)

func collect_item(item_name: String):
	"""Called when player collects an item"""
	GameManager.collect_item(item_name)
	update_ui()

	# Check if all items collected
	if GameManager.all_items_collected():
		show_victory_message()

func show_victory_message():
	"""Show victory message when all items collected"""
	print("All items collected! Palace magic restored!")
	# Could show a victory popup here
