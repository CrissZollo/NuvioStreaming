#!/bin/bash

# Build and install Android TV app to emulator/device
# Usage: ./build-and-install.sh [debug|release]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

BUILD_TYPE="${1:-debug}"

# Set Java 17
if [ -d "/usr/lib/jvm/java-17-openjdk" ]; then
    export JAVA_HOME="/usr/lib/jvm/java-17-openjdk"
elif [ -d "/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home" ]; then
    export JAVA_HOME="/Library/Java/JavaVirtualMachines/temurin-17.jdk/Contents/Home"
elif [ -d "$HOME/.sdkman/candidates/java/17"* ]; then
    export JAVA_HOME=$(ls -d "$HOME/.sdkman/candidates/java/17"* | head -1)
fi

echo "Using JAVA_HOME: $JAVA_HOME"
echo "Building $BUILD_TYPE APK..."

# Build
if [ "$BUILD_TYPE" = "release" ]; then
    ./gradlew assembleRelease
    APK_PATH="app/build/outputs/apk/release/app-release.apk"
else
    ./gradlew assembleDebug
    APK_PATH="app/build/outputs/apk/debug/app-debug.apk"
fi

echo ""
echo "Build complete: $APK_PATH"

# Check for connected device
if ! adb devices | grep -q "device$"; then
    echo ""
    echo "No device/emulator connected. Skipping install."
    echo "Start an emulator with: emulator -avd AndroidTV"
    exit 0
fi

echo ""
echo "Installing to device..."
adb install -r "$APK_PATH"

echo ""
echo "Launching app..."
adb shell am start -n com.nuvio.tv/.MainActivity

echo ""
echo "Done!"
