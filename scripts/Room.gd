extends Node2D

# Base room script - can be attached to room nodes or item nodes

@export var room_name: String = ""
@export var item_name: String = ""

var particles: CPUParticles2D

func _ready():
	# Check if this is an item that's already been collected
	if item_name != "" and GameManager.has_item(item_name):
		# Hide the item if already collected
		visible = false
	elif item_name != "":
		# This is a collectible item - add idle animation and particles
		setup_item_effects()

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

func setup_item_effects():
	"""Add visual effects to collectible items"""
	# Add floating animation
	var sprite = get_node_or_null("Sprite")
	if sprite:
		var tween = create_tween().set_loops()
		tween.tween_property(sprite, "position:y", -10, 1.0).set_ease(Tween.EASE_IN_OUT)
		tween.tween_property(sprite, "position:y", 0, 1.0).set_ease(Tween.EASE_IN_OUT)

	# Add sparkle particles
	particles = CPUParticles2D.new()
	add_child(particles)
	particles.emitting = true
	particles.amount = 8
	particles.lifetime = 1.0
	particles.emission_shape = CPUParticles2D.EMISSION_SHAPE_SPHERE
	particles.emission_sphere_radius = 20.0
	particles.direction = Vector2(0, -1)
	particles.spread = 45
	particles.gravity = Vector2(0, -20)
	particles.initial_velocity_min = 10.0
	particles.initial_velocity_max = 30.0
	particles.scale_amount_min = 2.0
	particles.scale_amount_max = 4.0
	particles.color = Color(1, 1, 0.5, 0.8)

func show_collection_effect():
	"""Show a collection animation with particles"""
	# Burst of particles
	if particles:
		particles.emitting = false
		particles.amount = 30
		particles.one_shot = true
		particles.explosiveness = 1.0
		particles.emitting = true

	# Scale up and fade animation
	var tween = create_tween()
	tween.set_parallel(true)
	tween.tween_property(self, "scale", Vector2(1.5, 1.5), 0.4)
	tween.tween_property(self, "modulate:a", 0.0, 0.4)
