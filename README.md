# Abyssal Drift

An immersive, beautifully rendered 3D deep-sea exploration game built with HTML5, CSS3, Javascript, and Three.js. Pilot a high-tech submersible through the tranquil marine depths, gather bioluminescent pearls to replenish oxygen, avoid electrical stings from deep-sea jellyfish, and unlock archives of mysterious marine species!

---

## 🚀 How to Run the Game

Since the game uses modern Javascript ES Modules (`importmap`), it must be served via a **local web server** rather than being opened directly as a file (`file://`).

You can launch a local server using any of the following quick methods:

### Option 1: Using Python (Recommended)
If you have Python installed, open your terminal in the project directory and run:
```bash
python -m http.server 8000
```
Then, open your browser and navigate to:
👉 **[http://localhost:8000](http://localhost:8000)**

### Option 2: Using Node.js (npm)
If you have Node.js installed, you can use `npx` to serve the folder instantly without installing any global packages:
```bash
npx http-server -p 8000
```
*or*
```bash
npx serve -p 8000
```
Then, open your browser and navigate to:
👉 **[http://localhost:8000](http://localhost:8000)** (or the port specified by serve)

### Option 3: Using VS Code Live Server
If you use VS Code, install the **Live Server** extension, open the project folder, and click **"Go Live"** in the bottom-right status bar.

---

## 🕹️ Controls Guide

### 💻 Desktop Controls
- **Pitch (Tilt Up/Down)**: Press `W` (Pitch Down) and `S` (Pitch Up) *or* hold **Space** (Ascend) and `X` (Descend).
- **Yaw (Steer Left/Right)**: Press `A` (Turn Left) and `D` (Turn Right).
- **Submarine Lights**: Press `L` to toggle the powerful forward searchlight.
- **Camera View Angle**: Press `C` to rotate through the 4 available camera views (Chase, First-Person, Top-Down, and Side views).
- **Autopilot**: Press `U` to engage/disengage autopilot homing system (once unlocked at the Mother Ship).
- **Object Scanner**: Move close to any marine object (within 28m) and hold `F` to scan it and catalog it.
- **Engine Gear Selector**: Press keys `0`, `1`, `2`, or `3` to shift gears (0: Stop, 1: Slow, 2: Cruise, 3: Boost).
- **Menu/Pause**: Press `Escape` to toggle the overlay menu.

### 📱 Mobile / Touch Controls
When playing on a mobile device or emulating touch inputs, a custom HUD overlay will appear:
- **Movement (Joystick)**: Drag the joystick knob in the center of the screen to translate and steer the submarine.
- **Descent / Ascent**: Press and hold the **UP** and **DOWN** buttons stacked on the left side.
- **Scanning**: Press and hold the **SCAN** button on the left side to lock onto and analyze nearby marine life.
- **Mother Ship & Autopilot**: Tap the respective icons at the top of the HUD to toggle autopilot or enter the Research upgrades dock.

---

## 🌟 Game Features

1. **Focused Submarine Headlight & Volumetric God-Ray**: The submersible features a powerful, tightly focused headlight projecting downwards at a 15-degree angle to illuminate the ocean floor directly in front of you. A shimmering volumetric light shaft cuts through the water, revealing details in the dark.
2. **Dynamic Depth-Based Lighting**: As you dive deeper into the abyss, sunlight fades out, the ambient glow decreases, and the water fog transitions into a pitch black, making your submarine's spotlight the only source of light.
3. **Responsive Mobile Touch Interface**: Features a custom mobile layout with a centered joystick, grouped action controls, and responsive styling.
4. **Mother Ship Docking & Upgrades**: Swim back to coordinates `(0, -1.2, 0)` to dock with the Research Vessel. Use collected pearl gems to upgrade thruster speed, improve oxygen filters, or unlock the Autopilot navigation system.
5. **Scientific Archives Database**: Scan bioluminescent pearls, abyssal jellyfish, schooling fish, seamounts, and solitary sharks to unlock deep-sea scientific readouts in your archives database.
