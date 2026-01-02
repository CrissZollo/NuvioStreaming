<!-- Improved compatibility of back to top link -->
<a id="readme-top"></a>

<!-- PROJECT SHIELDS -->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![License][license-shield]][license-url]

<!-- PROJECT LOGO -->
<br />
<div align="center">
  <img src="assets/titlelogo.png" alt="Nuvio Logo" width="120" />
  <h1 align="center">🎬 Nuvio Media Hub</h1>
  <p align="center">
    A modern media hub built with React Native and Expo
    <br />
    Stremio Addon ecosystem • Cross‑platform • Offline metadata & sync
    <br />
    <br />
    <a href="#getting-started"><strong>Get Started »</strong></a>
    <br />
    <br />

    <a href="https://github.com/tapframe/NuvioStreaming/issues/new?labels=bug&template=bug_report.md">Report Bug</a>
    ·
    <a href="https://github.com/tapframe/NuvioStreaming/issues/new?labels=enhancement&template=feature_request.md">Request Feature</a>
  </p>
</div>

<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li><a href="#about-the-project">About The Project</a></li>
    <li><a href="#installation">Installation</a></li>
    <li><a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#development-build">Development Build</a></li>
        <li><a href="#android-tv">Android TV</a></li>
      </ul>
    </li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#support">Support</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
    <li><a href="#built-with">Built With</a></li>
  </ol>
  </details>

<!-- ABOUT THE PROJECT -->
## About The Project

Nuvio Media Hub is a cross‑platform app for managing, discovering, and streaming your media via a flexible addon ecosystem. Built with React Native + Expo, it integrates providers and sync services while keeping a simple, fast UI.

 

<!-- INSTALLATION -->
## Installation

### Android
[![Download APK](https://img.shields.io/badge/Download-APK-green?style=for-the-badge)](https://github.com/tapframe/NuvioStreaming/releases/latest)

Download the latest APK from [GitHub Releases](https://github.com/tapframe/NuvioStreaming/releases/latest)

### iOS

#### TestFlight (Recommended)
<img src="https://upload.wikimedia.org/wikipedia/fr/b/bc/TestFlight-icon.png" width="24" height="24" align="left"> [![Join TestFlight](https://img.shields.io/badge/Join-TestFlight-blue?style=for-the-badge)](https://testflight.apple.com/join/QkKMGRqp)

#### AltStore
<img src="https://upload.wikimedia.org/wikipedia/commons/2/20/AltStore_logo.png" width="24" height="24" align="left"> [![Add to AltStore](https://img.shields.io/badge/Add%20to-AltStore-blue?style=for-the-badge)](https://tinyurl.com/NuvioAltstore)

#### SideStore
<img src="https://github.com/SideStore/assets/blob/main/icon.png?raw=true" width="24" height="24" align="left"> [![Add to SideStore](https://img.shields.io/badge/Add%20to-SideStore-green?style=for-the-badge)](https://tinyurl.com/NuvioSidestore)

**Manual URL:** `https://raw.githubusercontent.com/tapframe/NuvioStreaming/main/nuvio-source.json`

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- GETTING STARTED -->
## Getting Started

Follow the steps below to run the app locally for development.

### Development Build

<details>
  <summary>Build from Source</summary>

```bash
git clone https://github.com/tapframe/NuvioStreaming.git
cd NuvioStreaming
npm install
# If you hit peer dependency conflicts:
# npm install --legacy-peer-deps
npx expo start
```

```bash
npx expo prebuild
npx expo run:android  # Android
npx expo run:ios      # iOS
```

</details>

### Android TV

<details>
  <summary>Build & Run Android TV App</summary>

The Android TV app is a native Kotlin application located in the `android-tv/` directory.

#### Prerequisites

- **Java 17** (required for Gradle)
- **Android SDK** with Android TV system images
- **Android Studio** (recommended) or command-line tools

#### Building the APK

```bash
cd android-tv

# Set Java 17 (adjust path for your system)
export JAVA_HOME=/usr/lib/jvm/java-17-openjdk  # Linux
# export JAVA_HOME=/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home  # macOS

# Build debug APK
./gradlew assembleDebug

# Build release APK
./gradlew assembleRelease
```

The APK will be generated at:
- Debug: `android-tv/app/build/outputs/apk/debug/app-debug.apk`
- Release: `android-tv/app/build/outputs/apk/release/app-release.apk`

#### Running in Android TV Emulator

1. **Create an Android TV emulator** (if you don't have one):
   ```bash
   # List available TV system images
   sdkmanager --list | grep tv

   # Install a TV system image (example)
   sdkmanager "system-images;android-34;google_apis;x86_64"

   # Create the AVD
   avdmanager create avd -n AndroidTV -k "system-images;android-34;google_apis;x86_64" --device "tv_1080p"
   ```

2. **Start the emulator**:
   ```bash
   emulator -avd AndroidTV
   ```

3. **Install and run the app**:
   ```bash
   # Check device is connected
   adb devices

   # Install the APK
   adb install -r android-tv/app/build/outputs/apk/debug/app-debug.apk

   # Launch the app
   adb shell am start -n com.nuvio.tv/.MainActivity
   ```

#### D-pad Navigation

Use these keys in the emulator for navigation:
- **Arrow keys** - Navigate between items
- **Enter** - Select/confirm
- **Backspace** - Go back

</details>

<p align="right">(<a href="#readme-top">back to top</a>)</p>



## Contributing

Contributions make the open‑source community amazing! Any contributions are greatly appreciated.

1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Support

If you find Nuvio helpful, consider supporting development:

* **Ko‑Fi** – `https://ko-fi.com/tapframe`
* **GitHub Star** – Star the repo to show support
* **Share** – Tell others about the project

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## License

Distributed under the GNU GPLv3 License. See `LICENSE` for more information.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Contact

**Project Links:**
* GitHub: `https://github.com/tapframe`
* Issues: `https://github.com/tapframe/NuvioStreaming/issues`

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Acknowledgments

* [React Native](https://reactnative.dev/)
* [Expo](https://expo.dev/)
* [TypeScript](https://www.typescriptlang.org/)
* Community contributors and testers

**Disclaimer:** This application functions as a media hub with addon/plugin support. It does not contain any built‑in content or host media content. Content access is only available through user‑installed plugins and addons. Any legal concerns should be directed to the specific websites providing the content.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

## Built With

<p align="left">
  <a href="https://skillicons.dev">
    <img src="https://skillicons.dev/icons?i=react,typescript,nodejs,expo,github,githubactions&theme=light&perline=6" />
  </a>
  <br/>
  React Native • Expo • TypeScript
  </p>

  ## Star History

<a href="https://www.star-history.com/#tapframe/NuvioStreaming&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=tapframe/NuvioStreaming&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=tapframe/NuvioStreaming&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=tapframe/NuvioStreaming&type=date&legend=top-left" />
 </picture>
</a>

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
[contributors-shield]: https://img.shields.io/github/contributors/tapframe/NuvioStreaming.svg?style=for-the-badge
[contributors-url]: https://github.com/tapframe/NuvioStreaming/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/tapframe/NuvioStreaming.svg?style=for-the-badge
[forks-url]: https://github.com/tapframe/NuvioStreaming/network/members
[stars-shield]: https://img.shields.io/github/stars/tapframe/NuvioStreaming.svg?style=for-the-badge
[stars-url]: https://github.com/tapframe/NuvioStreaming/stargazers
[issues-shield]: https://img.shields.io/github/issues/tapframe/NuvioStreaming.svg?style=for-the-badge
[issues-url]: https://github.com/tapframe/NuvioStreaming/issues
[license-shield]: https://img.shields.io/github/license/tapframe/NuvioStreaming.svg?style=for-the-badge
[license-url]: http://www.gnu.org/licenses/gpl-3.0.en.html