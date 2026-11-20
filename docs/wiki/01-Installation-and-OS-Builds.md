# 01 — Installation & Cross-OS Build Guide

Drive Therapy supports running from source (`Node.js >= 22`), running zero-install prebuilt native executables (`Windows .exe`, `Linux x64`, `macOS arm64/x64`, `Android arm64`), packaging desktop installers via Electron, or building an Android WebView APK via Gradle.

---

## 1. Running Prebuilt Native Executables (Zero-Install Portable Mode)

When you run `npm run build:portable-bundle`, Drive Therapy compiles both the bundled Node.js server (`dist-portable/server.cjs`) and **5 native standalone executables** compiled from [`native-launcher/main.go`](../../native-launcher/main.go):

| Platform | Binary Name | How to Launch |
| :--- | :--- | :--- |
| **Windows 10 / 11 (`x64`)** | `DriveTherapy.exe` | Double-click `DriveTherapy.exe` (or `DriveTherapy.bat`) |
| **Linux (`x86_64`)** | `DriveTherapy-linux-x64` | `./DriveTherapy-linux-x64` (or `./DriveTherapy.sh`) |
| **macOS Apple Silicon (`M1–M4`)** | `DriveTherapy-macos-arm64` | Double-click `DriveTherapy.command` or `./DriveTherapy-macos-arm64` |
| **macOS Intel (`x86_64`)** | `DriveTherapy-macos-x64` | Double-click `DriveTherapy.command` or `./DriveTherapy-macos-x64` |
| **Android (`arm64-v8a`)** | `DriveTherapy-android-arm64` | `./DriveTherapy-android-arm64` inside Termux / ADB shell |

### How Dual-Mode Native Launch Works
1. **Full Express Mode**: If `node` and `server.cjs` are present alongside the executable, the launcher starts the full Node.js Express server on a clean port (`3010+`, skipping `3009`) and opens a native desktop window.
2. **Standalone Fallback Mode**: If `node` is **not** installed on the target machine, the native Go binary serves the production `dist/` web bundle and built-in offline API endpoints (`/api/health`, `/api/system/observability`, `/api/security/scan-buffer`, `/api/share/hero-links`, `/api/opensharing/shares`) directly with zero external runtime dependencies.

---

## 2. Building from Source (Linux, macOS, Windows)

```bash
# 1. Install dependencies
npm install

# 2. Optional: configure Google OAuth / Gemini API keys in .env
cp .env.example .env

# 3. Build production frontend & start server
npm run build
npm start
```

---

## 3. Building Desktop Installers (Electron)

- **Linux (`AppImage` & `.deb` with X11/Wayland & Tiling WM decoration detection)**:
  ```bash
  npm run build:electron:linux
  ```
- **Windows 10 / 11 (`NSIS` Installer & Portable `.exe`)**:
  ```bash
  npm run build:electron:win
  ```
- **macOS (`.dmg` & `.zip`)**:
  ```bash
  npm run build:electron:mac
  ```

---

## 4. Building for Android (`com.drivetherapy.studio`)

```bash
# 1. Compile web assets and synchronize the Android Gradle project (android/)
npm run build:android

# 2. Build the debug APK using Gradle and Android SDK 34:
cd android && gradle assembleDebug

# 3. Install to a connected Android device via ADB:
adb install -r app/build/outputs/apk/debug/app-debug.apk
```
