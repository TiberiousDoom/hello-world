extends Control

func _ready():
	# Center the window if running on desktop
	pass

func _on_start_button_pressed():
	# Load character selection screen
	get_tree().change_scene_to_file("res://scenes/CharacterSelect.tscn")

func _on_quit_button_pressed():
	# Quit the game
	get_tree().quit()
