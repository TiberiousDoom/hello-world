extends Puzzle
class_name TowerPuzzle

# Enchanted Tower Speed Puzzle: Quickly activate speed runes before time runs out
# Best for: Weasel (speed boost ability)

var runes_needed: int = 4
var runes_activated: int = 0
var rune_objects: Array = []
var time_limit: float = 15.0  # 15 seconds to activate all runes
var puzzle_timer: float = 0.0
var timer_running: bool = false

func _ready():
	super._ready()
	puzzle_name = "tower_speed"
	# Weasel is best for speed challenges
	preferred_characters = ["weasel"]
	show_hint_on_fail = true

	# Disable process by default - only enable when timer running
	set_process(false)

	# Auto-register runes
	await get_tree().process_frame
	auto_register_runes()

func auto_register_runes():
	"""Automatically find and register rune objects"""
	if has_node("Runes"):
		var runes_node = $Runes
		for child in runes_node.get_children():
			if child is Interactive:
				rune_objects.append(child)
				child.interacted.connect(_on_rune_activated.bind(child))

func _process(delta):
	if timer_running:
		puzzle_timer += delta
		if puzzle_timer >= time_limit:
			# Time's up!
			timer_running = false
			set_process(false)  # Stop processing when timer ends
			if runes_activated < runes_needed:
				print("� Time's up! Not fast enough. Try again with Weasel's speed boost!")
				reset_puzzle_state()

func reset_puzzle_state():
	"""Reset the puzzle for another attempt"""
	runes_activated = 0
	puzzle_timer = 0.0
	timer_running = false
	for rune in rune_objects:
		if rune:
			rune.modulate = Color(1, 1, 1)
			rune.has_been_used = false

func _on_rune_activated(character: Character, rune: Interactive):
	"""Called when character activates a rune"""
	# Start timer on first rune
	if runes_activated == 0:
		timer_running = true
		set_process(true)  # Enable processing when timer starts
		puzzle_timer = 0.0
		print("� Speed challenge started! Activate all %d runes within %.1f seconds!" % [runes_needed, time_limit])

	runes_activated += 1
	var time_left = time_limit - puzzle_timer
	print("� Rune activated! (%d/%d) - %.1fs remaining" % [runes_activated, runes_needed, time_left])

	# Visual feedback
	rune.modulate = Color(1.5, 1.5, 0.5)  # Bright yellow glow

	# Check if all runes activated in time
	if runes_activated >= runes_needed and timer_running:
		timer_running = false
		set_process(false)  # Stop processing when puzzle solved
		attempt_solve(character)

func check_solution(character: Character) -> bool:
	"""Puzzle solved when all runes activated within time limit"""
	return runes_activated >= runes_needed and puzzle_timer < time_limit

func on_solved(character: Character, time: float):
	"""When puzzle is completed"""
	print("� Lightning fast! All runes activated in %.2f seconds!" % puzzle_timer)
	print("( The Enchanted Crystal has been revealed!")

	# Make all runes glow brightly
	for rune in rune_objects:
		if rune:
			rune.modulate = Color(2.0, 2.0, 1.0)  # Very bright

func get_hint(character: Character) -> String:
	"""Provide helpful hints"""
	if not is_preferred_character(character):
		return "This challenge requires speed! Try using Weasel's speed boost ability!"

	if runes_activated == 0:
		return "Activate all %d runes within %.1f seconds! Use Weasel's speed boost for an advantage." % [runes_needed, time_limit]
	else:
		return "Keep going! %d more rune(s) to activate!" % (runes_needed - runes_activated)

func on_puzzle_already_solved():
	"""Make all runes glow if already solved"""
	runes_activated = runes_needed
	timer_running = false
	for rune in rune_objects:
		if rune:
			rune.modulate = Color(2.0, 2.0, 1.0)

func _exit_tree():
	"""Clean up resources when puzzle is removed"""
	# Disconnect all rune signals
	for rune in rune_objects:
		if rune and rune.interacted.is_connected(_on_rune_activated):
			rune.interacted.disconnect(_on_rune_activated)

	# Clear references
	rune_objects.clear()

	# Stop processing
	set_process(false)
