extends Control

func _on_character_selected(character_type: String):
	# Store the selected character globally
	GameManager.selected_character = character_type
	# Load the game scene
	get_tree().change_scene_to_file("res://scenes/Game.tscn")

func _on_back_button_pressed():
	# Return to main menu
	get_tree().change_scene_to_file("res://scenes/MainMenu.tscn")
