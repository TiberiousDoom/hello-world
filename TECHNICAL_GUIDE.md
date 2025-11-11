# Technical Implementation Guide 🔧

This guide provides specific technical approaches for implementing key features in Godot 4.

---

## 🗺️ Navigation & Pathfinding

### Current Issue
Characters move in straight lines, ignoring walls and obstacles.

### Solution: Navigation2D

```gdscript
# In Game.gd or Room scene
@onready var nav_region = $NavigationRegion2D

func _ready():
    # Navigation mesh will auto-generate from collision shapes
    pass

# In Character.gd
var nav_agent: NavigationAgent2D

func _ready():
    nav_agent = NavigationAgent2D.new()
    add_child(nav_agent)
    nav_agent.path_desired_distance = 4.0
    nav_agent.target_desired_distance = 4.0

func set_target(new_target: Vector2):
    nav_agent.target_position = new_target
    is_moving = true

func _physics_process(delta):
    if is_moving and not nav_agent.is_navigation_finished():
        var next_position = nav_agent.get_next_path_position()
        var direction = (next_position - position).normalized()
        velocity = direction * move_speed
        move_and_slide()
    else:
        is_moving = false
        velocity = Vector2.ZERO
```

### Setup Steps
1. Add `NavigationRegion2D` to each room scene
2. Add `NavigationPolygon` resource to it
3. Add `StaticBody2D` nodes for walls with `CollisionShape2D`
4. Bake navigation mesh in editor
5. Character will automatically path around obstacles

---

## 🧗 Character Abilities Implementation

### Ant: Wall Climbing

```gdscript
# In Ant.gd
var is_climbing: bool = false
var climbing_wall: Node2D = null

func _physics_process(delta):
    if is_climbing:
        # Disable gravity, allow vertical movement
        velocity.y = 0 if not is_moving else velocity.y

    super._physics_process(delta)

func use_special_ability():
    # Detect nearby walls
    var space_state = get_world_2d().direct_space_state
    var query = PhysicsRaycastQuery2D.create(position, position + Vector2(50, 0))
    var result = space_state.intersect_ray(query)

    if result:
        is_climbing = true
        climbing_wall = result.collider
        print("Climbing wall!")

func can_reach(target: Vector2) -> bool:
    # Ants can climb, so vertical distance doesn't matter
    return true
```

**Setup**:
- Add `RayCast2D` nodes to detect walls in 4 directions
- When ability activated and wall detected, change movement mode
- Allow vertical movement along wall surfaces

### Fairy: Flight Mode

```gdscript
# In Fairy.gd
var is_flying: bool = false
var flight_height: float = 100.0

func use_special_ability():
    is_flying = not is_flying
    if is_flying:
        # Float upward
        var tween = create_tween()
        tween.tween_property(self, "position:y", position.y - flight_height, 0.5)
        # Disable collision with ground obstacles
        collision_layer = 2  # Flying layer
    else:
        # Land
        var tween = create_tween()
        tween.tween_property(self, "position:y", position.y + flight_height, 0.5)
        collision_layer = 1  # Ground layer

func _physics_process(delta):
    if is_flying:
        # Ignore gravity, can move freely
        pass

    super._physics_process(delta)
```

**Setup**:
- Use collision layers: Layer 1 = ground, Layer 2 = flying
- Ground obstacles only collide with Layer 1
- Visual: Add floating animation, wings flapping

### Gnome: Digging Mechanic

```gdscript
# In Gnome.gd
var dig_duration: float = 2.0
var is_digging: bool = false

func use_special_ability():
    if is_digging:
        return

    # Check if standing on diggable ground
    var ground_check = $GroundRayCast
    if ground_check.is_colliding():
        var ground = ground_check.get_collider()
        if ground.is_in_group("diggable"):
            start_digging(ground)

func start_digging(ground: Node2D):
    is_digging = true
    # Play digging animation

    await get_tree().create_timer(dig_duration).timeout

    # Create tunnel/passage
    create_tunnel(position)
    is_digging = false

func create_tunnel(pos: Vector2):
    # Spawn a tunnel object that removes collision
    var tunnel = preload("res://objects/Tunnel.tscn").instantiate()
    get_parent().add_child(tunnel)
    tunnel.position = pos
```

**Setup**:
- Mark diggable areas with Area2D nodes in group "diggable"
- Create Tunnel scene that removes collision in its area
- Add particle effects for digging visual feedback

### Weasel: Speed Boost

```gdscript
# In Weasel.gd
var normal_speed: float = 300.0
var boost_speed: float = 500.0
var boost_duration: float = 3.0
var boost_cooldown: float = 5.0
var can_boost: bool = true

func use_special_ability():
    if not can_boost:
        print("Speed boost on cooldown!")
        return

    activate_speed_boost()

func activate_speed_boost():
    can_boost = false
    move_speed = boost_speed

    # Visual feedback - create trail effect
    $Trail.emitting = true

    # Duration
    await get_tree().create_timer(boost_duration).timeout
    move_speed = normal_speed
    $Trail.emitting = false

    # Cooldown
    await get_tree().create_timer(boost_cooldown).timeout
    can_boost = true
    print("Speed boost ready!")
```

**Setup**:
- Add CPUParticles2D or GPUParticles2D for trail effect
- Show cooldown timer in UI
- Add speed lines visual effect

---

## 🧩 Puzzle System Architecture

### Base Puzzle Class

```gdscript
# scripts/Puzzle.gd
extends Node2D
class_name Puzzle

signal puzzle_solved
signal puzzle_failed

@export var required_item: String = ""
@export var allowed_characters: Array[String] = []  # Empty = all allowed
@export var is_solved: bool = false

func can_solve(character: Character) -> bool:
    if is_solved:
        return false

    if allowed_characters.size() > 0:
        if not character.character_type in allowed_characters:
            return false

    if required_item != "":
        if not GameManager.has_item(required_item):
            return false

    return true

func attempt_solve(character: Character):
    if can_solve(character):
        solve()
    else:
        fail()

func solve():
    is_solved = true
    puzzle_solved.emit()
    on_solved()

func fail():
    puzzle_failed.emit()
    show_hint()

func on_solved():
    # Override in child classes
    pass

func show_hint():
    # Override in child classes
    pass
```

### Example: Height Puzzle (Ballroom Chandelier)

```gdscript
# puzzles/ChandelierPuzzle.gd
extends Puzzle

@onready var chandelier = $Chandelier
@onready var trigger_area = $TriggerArea

func _ready():
    trigger_area.body_entered.connect(_on_body_entered)
    allowed_characters = ["fairy", "ant"]  # Can fly or climb

func _on_body_entered(body):
    if body is Character:
        attempt_solve(body)

func on_solved():
    # Lower the chandelier
    var tween = create_tween()
    tween.tween_property(chandelier, "position:y", chandelier.position.y + 100, 2.0)

    # Spawn the crystal chandelier item
    var item = preload("res://items/CrystalChandelier.tscn").instantiate()
    add_child(item)

func show_hint():
    # Show message for ground-bound characters
    if get_tree().get_first_node_in_group("game"):
        var game = get_tree().get_first_node_in_group("game")
        game.show_message("You need to reach higher! Try a character that can fly or climb.")
```

---

## 💾 Save System

### GameManager Save/Load

```gdscript
# In GameManager.gd
const SAVE_PATH = "user://savegame.save"

func save_game():
    var save_file = FileAccess.open(SAVE_PATH, FileAccess.WRITE)
    if save_file:
        var save_data = {
            "selected_character": selected_character,
            "collected_items": collected_items,
            "current_room": current_room,
            "puzzles_solved": {},  # Add puzzle tracking
        }
        save_file.store_var(save_data)
        save_file.close()
        print("Game saved!")

func load_game():
    if not FileAccess.file_exists(SAVE_PATH):
        print("No save file found")
        return false

    var save_file = FileAccess.open(SAVE_PATH, FileAccess.READ)
    if save_file:
        var save_data = save_file.get_var()
        save_file.close()

        selected_character = save_data.get("selected_character", "ant")
        collected_items = save_data.get("collected_items", {})
        current_room = save_data.get("current_room", "kitchen")

        print("Game loaded!")
        return true
    return false

func delete_save():
    if FileAccess.file_exists(SAVE_PATH):
        DirAccess.remove_absolute(SAVE_PATH)
```

### Auto-Save on Item Collection

```gdscript
# In Game.gd
func collect_item(item_name: String):
    GameManager.collect_item(item_name)
    update_ui()

    # Auto-save
    GameManager.save_game()

    if GameManager.all_items_collected():
        show_victory_message()
```

---

## 📹 Camera System

### Smooth Follow Camera

```gdscript
# scripts/GameCamera.gd
extends Camera2D

@export var follow_speed: float = 5.0
@export var look_ahead_distance: float = 50.0

var target: Node2D = null

func _ready():
    # Enable smoothing
    position_smoothing_enabled = true
    position_smoothing_speed = follow_speed

func set_target(new_target: Node2D):
    target = new_target

func _process(delta):
    if target:
        # Follow target with look-ahead
        var target_pos = target.global_position

        # Add look-ahead based on movement direction
        if target is Character:
            target_pos += target.velocity.normalized() * look_ahead_distance

        global_position = target_pos
```

### Room-Specific Camera Bounds

```gdscript
# In Room.gd
@export var camera_bounds: Rect2 = Rect2(0, 0, 1280, 720)

func _ready():
    super._ready()
    setup_camera_bounds()

func setup_camera_bounds():
    var camera = get_tree().get_first_node_in_group("camera")
    if camera:
        camera.limit_left = camera_bounds.position.x
        camera.limit_top = camera_bounds.position.y
        camera.limit_right = camera_bounds.position.x + camera_bounds.size.x
        camera.limit_bottom = camera_bounds.position.y + camera_bounds.size.y
```

---

## 🎨 Animation System

### Character Animation State Machine

```gdscript
# In Character.gd
@onready var animation_player = $AnimationPlayer
@onready var sprite = $Sprite2D

enum AnimState { IDLE, WALK, ABILITY, JUMP }
var current_anim_state: AnimState = AnimState.IDLE

func _physics_process(delta):
    update_animation()
    super._physics_process(delta)

func update_animation():
    var new_state: AnimState

    if is_using_ability:
        new_state = AnimState.ABILITY
    elif velocity.length() > 10:
        new_state = AnimState.WALK
    else:
        new_state = AnimState.IDLE

    if new_state != current_anim_state:
        current_anim_state = new_state
        play_animation()

    # Flip sprite based on direction
    if velocity.x != 0:
        sprite.flip_h = velocity.x < 0

func play_animation():
    match current_anim_state:
        AnimState.IDLE:
            animation_player.play("idle")
        AnimState.WALK:
            animation_player.play("walk")
        AnimState.ABILITY:
            animation_player.play("ability")
```

### Creating Animations

1. Add `AnimationPlayer` node to character
2. Create animations:
   - `idle`: 2-4 frame loop
   - `walk`: 4-8 frame loop
   - `ability`: Character-specific
3. Animate the `Sprite2D.frame` property
4. Set loop modes appropriately

---

## 🎵 Audio Management

### Audio Bus Setup

```gdscript
# In a global script or main scene
func setup_audio_buses():
    # Get audio buses
    var master_bus = AudioServer.get_bus_index("Master")
    var music_bus = AudioServer.get_bus_index("Music")
    var sfx_bus = AudioServer.get_bus_index("SFX")

    # Create if they don't exist
    if music_bus == -1:
        AudioServer.add_bus()
        music_bus = AudioServer.bus_count - 1
        AudioServer.set_bus_name(music_bus, "Music")
        AudioServer.set_bus_send(music_bus, "Master")

    if sfx_bus == -1:
        AudioServer.add_bus()
        sfx_bus = AudioServer.bus_count - 1
        AudioServer.set_bus_name(sfx_bus, "SFX")
        AudioServer.set_bus_send(sfx_bus, "Master")
```

### Background Music Manager

```gdscript
# scripts/MusicManager.gd (Autoload)
extends Node

var current_track: AudioStreamPlayer = null
var room_music: Dictionary = {
    "kitchen": preload("res://assets/sounds/music/kitchen.ogg"),
    "throne_room": preload("res://assets/sounds/music/throne.ogg"),
    # ... etc
}

func play_room_music(room_name: String):
    if room_name in room_music:
        change_track(room_music[room_name])

func change_track(new_track: AudioStream):
    if current_track:
        fade_out(current_track)

    current_track = AudioStreamPlayer.new()
    current_track.stream = new_track
    current_track.bus = "Music"
    add_child(current_track)

    current_track.volume_db = -20
    current_track.play()

    # Fade in
    var tween = create_tween()
    tween.tween_property(current_track, "volume_db", 0, 1.0)

func fade_out(track: AudioStreamPlayer):
    var tween = create_tween()
    tween.tween_property(track, "volume_db", -80, 1.0)
    tween.tween_callback(track.queue_free)
```

### Sound Effect Player

```gdscript
# scripts/SFXManager.gd (Autoload)
extends Node

var sfx_players: Array[AudioStreamPlayer] = []
var max_players: int = 10

func _ready():
    # Create pool of audio players
    for i in range(max_players):
        var player = AudioStreamPlayer.new()
        player.bus = "SFX"
        add_child(player)
        sfx_players.append(player)

func play_sfx(sound: AudioStream, volume: float = 0.0):
    # Find available player
    for player in sfx_players:
        if not player.playing:
            player.stream = sound
            player.volume_db = volume
            player.play()
            return

    # If all busy, play on first one (interrupt)
    sfx_players[0].stream = sound
    sfx_players[0].play()
```

---

## 🎯 Interactive Objects System

### Base Interactive Object

```gdscript
# scripts/Interactive.gd
extends Area2D
class_name Interactive

signal interacted(character: Character)

@export var interaction_prompt: String = "Press E to interact"
@export var requires_ability: String = ""  # e.g., "fly", "dig", "climb"

var nearby_character: Character = null

func _ready():
    body_entered.connect(_on_body_entered)
    body_exited.connect(_on_body_exited)

func _on_body_entered(body):
    if body is Character:
        nearby_character = body
        show_prompt()

func _on_body_exited(body):
    if body == nearby_character:
        nearby_character = null
        hide_prompt()

func _input(event):
    if event.is_action_pressed("interact") and nearby_character:
        if can_interact(nearby_character):
            interact(nearby_character)

func can_interact(character: Character) -> bool:
    if requires_ability == "":
        return true

    match requires_ability:
        "fly":
            return character.can_fly
        "dig":
            return character.can_dig
        "climb":
            return character.can_climb_walls
        "speed":
            return character.has_speed_boost

    return false

func interact(character: Character):
    interacted.emit(character)
    on_interact(character)

func on_interact(character: Character):
    # Override in child classes
    pass

func show_prompt():
    # Show UI prompt
    pass

func hide_prompt():
    # Hide UI prompt
    pass
```

---

## 🎁 Item Collection with Effects

### Collectible Item

```gdscript
# scripts/CollectibleItem.gd
extends Area2D

@export var item_name: String = ""
@export var display_name: String = ""
@onready var particles = $CPUParticles2D
@onready var sprite = $Sprite2D

func _ready():
    body_entered.connect(_on_collected)

    # Check if already collected
    if GameManager.has_item(item_name):
        queue_free()

    # Idle animation
    var tween = create_tween().set_loops()
    tween.tween_property(sprite, "position:y", -10, 1.0)
    tween.tween_property(sprite, "position:y", 0, 1.0)

func _on_collected(body):
    if body is Character:
        collect()

func collect():
    # Play collection animation
    particles.emitting = true

    var tween = create_tween()
    tween.tween_property(sprite, "scale", Vector2(1.5, 1.5), 0.3)
    tween.parallel().tween_property(sprite, "modulate:a", 0.0, 0.3)

    # Play sound
    SFXManager.play_sfx(preload("res://assets/sounds/sfx/collect.ogg"))

    # Collect in game manager
    GameManager.collect_item(item_name)

    # Show notification
    show_collection_notification()

    await tween.finished
    queue_free()

func show_collection_notification():
    var label = Label.new()
    label.text = "Collected: " + display_name
    label.modulate = Color(1, 1, 0)
    get_tree().root.add_child(label)
    label.global_position = global_position + Vector2(-50, -50)

    var tween = create_tween()
    tween.tween_property(label, "position:y", label.position.y - 50, 1.0)
    tween.parallel().tween_property(label, "modulate:a", 0.0, 1.0)
    tween.tween_callback(label.queue_free)
```

---

## 🏗️ Room Scene Template

Each room should follow this structure:

```
RoomName (Node2D)
├── Background (ColorRect or Sprite2D)
├── NavigationRegion2D
│   └── NavigationPolygon
├── Walls (StaticBody2D)
│   └── CollisionShape2D (multiple)
├── Floor (StaticBody2D)
│   └── CollisionShape2D
├── Props (Node2D)
│   ├── Table (Sprite2D)
│   ├── Chair (Sprite2D)
│   └── ...
├── Items (Node2D)
│   └── ItemName (Area2D) [CollectibleItem.gd]
├── Puzzles (Node2D)
│   └── PuzzleName (Node2D) [Puzzle.gd]
├── Interactives (Node2D)
│   ├── Door (Area2D) [Interactive.gd]
│   └── Lever (Area2D) [Interactive.gd]
└── SpawnPoint (Marker2D)
```

---

## 🔍 Debugging Tools

### Debug Mode

```gdscript
# In GameManager.gd
var debug_mode: bool = false

func _input(event):
    # Toggle debug with F3
    if event.is_action_pressed("ui_page_up"):
        debug_mode = not debug_mode
        print("Debug mode: ", debug_mode)

    if debug_mode:
        # F4 = unlock all items
        if event.is_action_pressed("ui_page_down"):
            unlock_all_items()

        # F5 = reset progress
        if event.is_action_pressed("ui_select"):
            reset_game()

func unlock_all_items():
    for item in collected_items:
        collected_items[item] = true
    print("All items unlocked!")
```

### Debug Overlay

```gdscript
# scripts/DebugOverlay.gd
extends CanvasLayer

@onready var label = $Label

func _process(delta):
    if GameManager.debug_mode:
        visible = true
        update_debug_info()
    else:
        visible = false

func update_debug_info():
    var player = get_tree().get_first_node_in_group("player")
    var fps = Engine.get_frames_per_second()

    var text = "FPS: %d\n" % fps
    if player:
        text += "Pos: %v\n" % player.position
        text += "Velocity: %v\n" % player.velocity
    text += "Room: %s\n" % GameManager.current_room
    text += "Items: %d/7" % GameManager.get_collected_count()

    label.text = text
```

---

**Next**: See DEVELOPMENT_PLAN.md for what to build and when!
