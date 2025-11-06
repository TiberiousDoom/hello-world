extends Node2D

# Base room script - can be attached to room nodes or item nodes

@export var room_name: String = ""
@export var item_name: String = ""

func _ready():
	# Check if this is an item that's already been collected
	if item_name != "" and GameManager.has_item(item_name):
		# Hide the item if already collected
		visible = false

func _on_item_collected(body):
	"""Called when character touches an item"""
	if body is Character and item_name != "":
		# Collect the item
		GameManager.collect_item(item_name)

		# Visual feedback
		show_collection_effect()

		# Hide the item
		visible = false

		# Notify the game scene
		var game = get_tree().get_first_node_in_group("game")
		if game and game.has_method("collect_item"):
			game.collect_item(item_name)

		print("Collected: ", item_name)

func show_collection_effect():
	"""Show a simple collection animation"""
	# Create a simple tween animation
	var tween = create_tween()
	tween.tween_property(self, "scale", Vector2(1.5, 1.5), 0.3)
	tween.tween_property(self, "modulate:a", 0.0, 0.3)
