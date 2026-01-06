const { withAndroidManifest, withDangerousMod, withMainApplication, withMainActivity } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Copy TV detection native module files to android project
 */
function copyTVDetectionFiles(projectRoot) {
    const sourceDir = path.join(projectRoot, 'plugins', 'android-tv', 'android');
    const destDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'java', 'com', 'nuvio', 'app', 'tv');

    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    // Copy all Kotlin files from source to destination
    if (fs.existsSync(sourceDir)) {
        const files = fs.readdirSync(sourceDir);
        files.forEach(file => {
            if (file.endsWith('.kt')) {
                const srcFile = path.join(sourceDir, file);
                const destFile = path.join(destDir, file);
                if (fs.statSync(srcFile).isFile()) {
                    fs.copyFileSync(srcFile, destFile);
                    console.log(`[android-tv] Copied ${file} to android project`);
                }
            }
        });
    }
}

/**
 * Modify AndroidManifest.xml for Android TV support
 */
function withTVManifest(config) {
    return withAndroidManifest(config, async (config) => {
        const manifest = config.modResults.manifest;

        // Initialize uses-feature array if not present
        if (!manifest['uses-feature']) {
            manifest['uses-feature'] = [];
        }

        // Add leanback feature (not required = works on both phone and TV)
        const hasLeanback = manifest['uses-feature'].some(
            f => f.$?.['android:name'] === 'android.software.leanback'
        );
        if (!hasLeanback) {
            manifest['uses-feature'].push({
                $: {
                    'android:name': 'android.software.leanback',
                    'android:required': 'false'
                }
            });
            console.log('[android-tv] Added leanback feature');
        }

        // Add touchscreen as not required for TV compatibility
        const hasTouchscreen = manifest['uses-feature'].some(
            f => f.$?.['android:name'] === 'android.hardware.touchscreen'
        );
        if (!hasTouchscreen) {
            manifest['uses-feature'].push({
                $: {
                    'android:name': 'android.hardware.touchscreen',
                    'android:required': 'false'
                }
            });
            console.log('[android-tv] Added touchscreen feature (not required)');
        }

        // Get application element
        const application = manifest.application?.[0];
        if (application) {
            // Add TV banner to application
            if (!application.$['android:banner']) {
                application.$['android:banner'] = '@drawable/tv_banner';
                console.log('[android-tv] Added TV banner');
            }

            // Find MainActivity and add LEANBACK_LAUNCHER category
            const mainActivity = application.activity?.find(
                a => a.$?.['android:name'] === '.MainActivity'
            );

            if (mainActivity) {
                // Ensure intent-filter array exists
                if (!mainActivity['intent-filter']) {
                    mainActivity['intent-filter'] = [];
                }

                // Check if LEANBACK_LAUNCHER is already present
                const hasLeanbackLauncher = mainActivity['intent-filter'].some(
                    filter => filter.category?.some(
                        cat => cat.$?.['android:name'] === 'android.intent.category.LEANBACK_LAUNCHER'
                    )
                );

                if (!hasLeanbackLauncher) {
                    // Add new intent-filter for TV launcher
                    mainActivity['intent-filter'].push({
                        action: [{
                            $: { 'android:name': 'android.intent.action.MAIN' }
                        }],
                        category: [{
                            $: { 'android:name': 'android.intent.category.LEANBACK_LAUNCHER' }
                        }]
                    });
                    console.log('[android-tv] Added LEANBACK_LAUNCHER intent filter');
                }
            }
        }

        return config;
    });
}

/**
 * Modify MainApplication.kt to include TVDetectionPackage
 */
function withTVMainApplication(config) {
    return withMainApplication(config, async (config) => {
        let contents = config.modResults.contents;

        // Add import for TVDetectionPackage
        const tvImport = 'import com.nuvio.app.tv.TVDetectionPackage';
        if (!contents.includes(tvImport)) {
            // Add import after the last import statement
            const lastImportIndex = contents.lastIndexOf('import ');
            const endOfLastImport = contents.indexOf('\n', lastImportIndex);
            contents = contents.slice(0, endOfLastImport + 1) + tvImport + '\n' + contents.slice(endOfLastImport + 1);
            console.log('[android-tv] Added TVDetectionPackage import');
        }

        // Add TVDetectionPackage to the packages list
        // Handle both old format (return PackageList...) and new format (= PackageList...)
        if (!contents.includes('add(TVDetectionPackage())')) {
            // Try new format first: PackageList(this).packages.apply {
            const newFormatPattern = /PackageList\(this\)\.packages\.apply\s*\{/;
            if (contents.match(newFormatPattern)) {
                contents = contents.replace(
                    newFormatPattern,
                    (match) => match + '\n              add(TVDetectionPackage())'
                );
                console.log('[android-tv] Added TVDetectionPackage to packages list (new format)');
            } else {
                // Try old format: return PackageList(this).packages.apply {
                const oldFormatPattern = /override fun getPackages\(\): List<ReactPackage> \{[\s\S]*?return PackageList\(this\)\.packages\.apply \{/;
                if (contents.match(oldFormatPattern)) {
                    contents = contents.replace(
                        oldFormatPattern,
                        (match) => match + '\n          add(TVDetectionPackage())'
                    );
                    console.log('[android-tv] Added TVDetectionPackage to packages list (old format)');
                }
            }
        }

        config.modResults.contents = contents;
        return config;
    });
}

/**
 * Modify MainActivity.kt to intercept TV key events
 */
function withTVMainActivity(config) {
    return withMainActivity(config, async (config) => {
        let contents = config.modResults.contents;

        // Add import for KeyEvent and TVKeyEventModule
        const keyEventImport = 'import android.view.KeyEvent';
        const tvKeyEventModuleImport = 'import com.nuvio.app.tv.TVKeyEventModule';

        if (!contents.includes(keyEventImport)) {
            // Add import after android.os.Bundle
            contents = contents.replace(
                'import android.os.Bundle',
                'import android.os.Bundle\nimport android.view.KeyEvent'
            );
            console.log('[android-tv] Added KeyEvent import to MainActivity');
        }

        if (!contents.includes(tvKeyEventModuleImport)) {
            // Add import before class declaration
            const classIndex = contents.indexOf('class MainActivity');
            contents = contents.slice(0, classIndex) + tvKeyEventModuleImport + '\n\n' + contents.slice(classIndex);
            console.log('[android-tv] Added TVKeyEventModule import to MainActivity');
        }

        // Add onKeyDown and onKeyUp overrides before the closing brace
        if (!contents.includes('override fun onKeyDown')) {
            const keyEventHandlers = `

  /**
   * Intercept key events from TV remote and forward to React Native
   */
  override fun onKeyDown(keyCode: Int, event: KeyEvent?): Boolean {
      TVKeyEventModule.getInstance()?.sendKeyEvent(keyCode, KeyEvent.ACTION_DOWN)
      return super.onKeyDown(keyCode, event)
  }

  override fun onKeyUp(keyCode: Int, event: KeyEvent?): Boolean {
      TVKeyEventModule.getInstance()?.sendKeyEvent(keyCode, KeyEvent.ACTION_UP)
      return super.onKeyUp(keyCode, event)
  }
}`;
            // Replace the closing brace of the class
            contents = contents.replace(/\n\}[\s]*$/, keyEventHandlers);
            console.log('[android-tv] Added key event handlers to MainActivity');
        }

        config.modResults.contents = contents;
        return config;
    });
}

/**
 * Copy TV banner drawable
 */
function copyTVBanner(projectRoot) {
    const sourceFile = path.join(projectRoot, 'assets', 'android', 'tv_banner.png');
    const destDir = path.join(projectRoot, 'android', 'app', 'src', 'main', 'res', 'drawable');
    const destFile = path.join(destDir, 'tv_banner.png');

    // Create destination directory if it doesn't exist
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }

    // Copy banner if source exists
    if (fs.existsSync(sourceFile)) {
        fs.copyFileSync(sourceFile, destFile);
        console.log('[android-tv] Copied TV banner to drawable');
    } else {
        // Create a placeholder message if banner doesn't exist
        console.warn('[android-tv] Warning: TV banner not found at assets/android/tv_banner.png');
        console.warn('[android-tv] Please add a 320x180 PNG image for the Android TV launcher');
    }
}

/**
 * Main plugin function
 */
function withAndroidTV(config) {
    // Copy native files during prebuild
    config = withDangerousMod(config, [
        'android',
        async (config) => {
            copyTVDetectionFiles(config.modRequest.projectRoot);
            copyTVBanner(config.modRequest.projectRoot);
            return config;
        },
    ]);

    // Modify AndroidManifest for TV support
    config = withTVManifest(config);

    // Modify MainApplication to register the TV detection package
    config = withTVMainApplication(config);

    // Modify MainActivity to handle TV key events
    config = withTVMainActivity(config);

    return config;
}

module.exports = withAndroidTV;
