extends Node2D
class_name Puzzle

# Base class for all puzzles in the game

signal puzzle_started
signal puzzle_completed
signal puzzle_failed
signal hint_requested

@export var puzzle_name: String = ""
@export var required_item: String = ""  # Item needed to solve (empty = none)
@export var preferred_characters: Array[String] = []  # Best characters (empty = all)
@export var allowed_characters: Array[String] = []  # Can solve (empty = all allowed)
@export var is_solved: bool = false
@export var show_hint_on_fail: bool = true

var attempts: int = 0
var start_time: float = 0.0

func _ready():
	# Add to group for easy lookup
	if puzzle_name != "":
		add_to_group("puzzle_" + puzzle_name)

	# Check if already solved
	if GameManager.is_puzzle_solved(puzzle_name):
		is_solved = true
		on_puzzle_already_solved()

func can_attempt(character: Character) -> bool:
	"""Check if character can attempt this puzzle"""
	if is_solved:
		return false

	# Check if character is allowed
	if allowed_characters.size() > 0:
		if not character.character_type in allowed_characters:
			return false

	# Check if required item is collected
	if required_item != "":
		if not GameManager.has_item(required_item):
			return false

	return true

func is_preferred_character(character: Character) -> bool:
	"""Check if this is an optimal character for the puzzle"""
	if preferred_characters.size() == 0:
		return true  # All characters equally good
	return character.character_type in preferred_characters

func attempt_solve(character: Character):
	"""Attempt to solve puzzle with given character"""
	if not can_attempt(character):
		on_attempt_failed(character)
		return

	attempts += 1
	if attempts == 1:
		start_time = Time.get_ticks_msec() / 1000.0
		puzzle_started.emit()

	# Check puzzle-specific logic
	if check_solution(character):
		solve(character)
	else:
		on_attempt_failed(character)

func check_solution(character: Character) -> bool:
	"""Override in child classes - return true if puzzle solved"""
	return false

func solve(character: Character):
	"""Mark puzzle as solved"""
	is_solved = true
	var solve_time = (Time.get_ticks_msec() / 1000.0) - start_time

	# Save to game manager
	GameManager.mark_puzzle_solved(puzzle_name)

	# Emit signal
	puzzle_completed.emit()

	# Call puzzle-specific completion
	on_solved(character, solve_time)

	print("✅ Puzzle '%s' solved by %s in %.1f seconds!" % [puzzle_name, character.character_type, solve_time])

func on_solved(character: Character, time: float):
	"""Override in child classes for puzzle-specific completion"""
	pass

func on_attempt_failed(character: Character):
	"""Called when puzzle attempt fails"""
	puzzle_failed.emit()

	if show_hint_on_fail:
		show_hint(character)

func show_hint(character: Character):
	"""Show hint for solving the puzzle"""
	var hint = get_hint(character)
	if hint != "":
		hint_requested.emit()
		show_hint_message(hint)

func get_hint(character: Character) -> String:
	"""Override in child classes to provide character-specific hints"""
	if not can_attempt(character):
		if is_solved:
			return "This puzzle is already solved!"
		if required_item != "":
			return "You need the %s to solve this puzzle." % required_item
		if allowed_characters.size() > 0 and not character.character_type in allowed_characters:
			var chars = ", ".join(allowed_characters)
			return "Try using: %s" % chars

	return "Try interacting with objects in this room."

func show_hint_message(hint: String):
	"""Display hint to player"""
	print("💡 Hint: ", hint)
	# This will be enhanced with UI in next step

func on_puzzle_already_solved():
	"""Called when puzzle was already solved in a previous session"""
	# Hide puzzle objects or show completed state
	pass

func reset_puzzle():
	"""Reset puzzle state (for testing)"""
	is_solved = false
	attempts = 0
	GameManager.mark_puzzle_unsolved(puzzle_name)
