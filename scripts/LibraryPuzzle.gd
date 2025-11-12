extends Puzzle
class_name LibraryPuzzle

# Library Book Puzzle: Organize scattered books back onto the shelf
# Best for: Gnome (crafting/organizing skills) but all can attempt

var books_needed: int = 4
var books_shelved: int = 0
var book_objects: Array = []

func _ready():
	super._ready()
	puzzle_name = "library_books"
	# Gnome is best but all characters can help organize
	preferred_characters = ["gnome"]
	show_hint_on_fail = true

	# Auto-register books
	await get_tree().process_frame
	auto_register_books()

func auto_register_books():
	"""Automatically find and register book objects"""
	if has_node("Books"):
		var books_node = $Books
		for child in books_node.get_children():
			if child is Interactive:
				book_objects.append(child)
				child.interacted.connect(_on_book_shelved.bind(child))

func _on_book_shelved(character: Character, book: Interactive):
	"""Called when character places a book on shelf"""
	books_shelved += 1
	print("=� Book shelved! (%d/%d)" % [books_shelved, books_needed])

	# Visual feedback - fade book
	book.modulate = Color(0.7, 0.7, 0.7, 0.5)  # Faded

	# Check if all books are shelved
	if books_shelved >= books_needed:
		# Automatically solve the puzzle
		attempt_solve(character)

func check_solution(character: Character) -> bool:
	"""Puzzle solved when all books are organized"""
	return books_shelved >= books_needed

func on_solved(character: Character, time: float):
	"""When puzzle is completed"""
	print("=� All books organized! The library is in order!")
	print("( The Glowing Book has been revealed!")

	# Make all books transparent
	for book in book_objects:
		if book:
			book.modulate = Color(1, 1, 1, 0)  # Invisible

func get_hint(character: Character) -> String:
	"""Provide helpful hints"""
	if not is_preferred_character(character):
		print("=� %s can organize the books, but Gnome is more efficient!" % character.character_type.capitalize())

	if books_shelved == 0:
		return "Click on the scattered books to place them on the shelf! There are %d books." % books_needed
	elif books_shelved < books_needed:
		return "Keep organizing! %d more book(s) to shelve." % (books_needed - books_shelved)
	else:
		return "All books organized perfectly!"

func on_puzzle_already_solved():
	"""Make all books invisible if already solved"""
	books_shelved = books_needed
	for book in book_objects:
		if book:
			book.modulate = Color(1, 1, 1, 0)

func _exit_tree():
	"""Clean up resources when puzzle is removed"""
	# Disconnect all book signals
	for book in book_objects:
		if book and book.interacted.is_connected(_on_book_shelved):
			book.interacted.disconnect(_on_book_shelved)

	# Clear references
	book_objects.clear()
