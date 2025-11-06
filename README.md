# Fairy Tale Palace Adventure 🏰✨

A magical 2D side-scrolling adventure game for kids, built with Godot 4.2!

## 🎮 Game Overview

Explore a hidden lost palace in a fantasy world inhabited by ants, fairies, and gnomes. Your quest is to restore the palace's magic by collecting magical items scattered throughout different rooms!

### Features

- **4 Playable Characters** - Each with unique abilities:
  - 🐜 **The Ant** - Wall climbing & access to tiny tunnels
  - 🧚 **The Fairy** - Flight & magic-based puzzle solving
  - 👨 **The Gnome** - Tool crafting & digging
  - 🦦 **The Weasel** - Super speed & burrowing

- **Tap-to-Move Controls** - Simple, kid-friendly gameplay
- **7 Magical Items** to collect across different palace rooms
- **2 Prototype Rooms** (Kitchen & Throne Room) with more coming soon!

## 🚀 Getting Started

### Prerequisites

- **Godot Engine 4.2+** - [Download here](https://godotengine.org/download)
- Git (for cloning the repository)

### Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/TiberiousDoom/hello-world.git
   cd hello-world
   ```

2. Open Godot Engine

3. Click **Import** and navigate to the project folder

4. Select the `project.godot` file

5. Click **Import & Edit**

### Running the Game

1. Once the project is open in Godot, press **F5** or click the **Play** button in the top-right corner

2. The game will launch with the main menu

3. Click **Start Adventure** to begin!

## 🎯 How to Play

1. **Choose Your Character** - Select from Ant, Fairy, Gnome, or Weasel
2. **Explore Rooms** - Click anywhere on the screen to move your character
3. **Collect Items** - Walk into glowing magical items to collect them
4. **Use Special Abilities** - Click the "Use Ability" button for character-specific powers
5. **Switch Rooms** - Use the "Next Room" button to explore different areas
6. **Restore the Palace** - Collect all magical items to restore the palace's magic!

## 🏗️ Project Structure

```
hello-world/
├── project.godot           # Main project configuration
├── scenes/                 # Game scenes
│   ├── MainMenu.tscn      # Main menu
│   ├── CharacterSelect.tscn  # Character selection
│   └── Game.tscn          # Main game scene
├── scripts/                # GDScript files
│   ├── GameManager.gd     # Global game state manager
│   ├── Character.gd       # Base character class
│   ├── Ant.gd, Fairy.gd, Gnome.gd, Weasel.gd
│   ├── Game.gd            # Main game controller
│   └── Room.gd            # Room and item logic
├── characters/             # Character scene files
│   ├── Ant.tscn
│   ├── Fairy.tscn
│   ├── Gnome.tscn
│   └── Weasel.tscn
├── rooms/                  # Room scenes
│   ├── Kitchen.tscn       # Kitchen with Golden Spoon
│   └── ThroneRoom.tscn    # Throne Room with Magic Gem
└── assets/                 # Game assets (sprites, sounds)
    ├── sprites/
    └── sounds/
```

## 🎨 Current Prototype Features

### Implemented
- ✅ Main menu system
- ✅ Character selection screen
- ✅ 4 playable characters with unique abilities
- ✅ Tap-to-move control system
- ✅ 2 demo rooms (Kitchen & Throne Room)
- ✅ Item collection system
- ✅ Global game state management
- ✅ Simple HUD showing character info and item count

### Coming Soon
- 🔄 Additional rooms (Cellar, Ballroom, Garden, Library, Tower)
- 🔄 More magical items to collect
- 🔄 Character-specific puzzles
- 🔄 Sound effects and music
- 🔄 Better pixel art sprites
- 🔄 Victory screen when all items are collected
- 🔄 Character ability animations

## 🛠️ Development

### Adding New Rooms

1. Create a new scene file in the `rooms/` folder
2. Inherit from `Node2D` and attach the `Room.gd` script
3. Set the `room_name` export variable
4. Add visual elements (ColorRect nodes for prototype)
5. Add collectible items as `Area2D` nodes with the `Room.gd` script
6. Set the `item_name` export variable on items
7. Add the room to `room_scenes` dictionary in `Game.gd`

### Adding New Characters

1. Create a new script inheriting from `Character`
2. Override the `setup_character()` function
3. Set abilities: `can_climb_walls`, `can_fly`, `can_dig`, `has_speed_boost`
4. Implement `use_special_ability()` for unique powers
5. Create a scene file in `characters/` folder
6. Add to `character_scenes` dictionary in `Game.gd`

## 📝 Design Philosophy

- **Kid-Friendly**: Simple controls, no complex timing challenges
- **Non-Violent**: Peaceful exploration and puzzle solving
- **Forgiving**: Multiple characters can solve most puzzles in different ways
- **Magical**: Whimsical fairy tale atmosphere

## 🤝 Contributing

This is a prototype project! Contributions are welcome:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📜 License

This project is open source and available for educational purposes.

## 🎵 Asset Attribution

Currently using placeholder graphics. Future versions will include:
- Pixel art sprites
- Royalty-free music from OpenGameArt.org and Freesound.org
- Sound effects from Creative Commons sources

## 🙏 Credits

- Built with [Godot Engine](https://godotengine.org/)
- Game design inspired by classic adventure games for children
- Created as a prototype for a peaceful, magical adventure experience

## 📧 Contact

For questions or suggestions, please open an issue on GitHub!

---

**Happy adventuring! May your quest restore the palace's magic! ✨🏰**
