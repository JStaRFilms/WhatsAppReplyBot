const { withAppBuildGradle, withProjectBuildGradle, withAndroidManifest, withGradleProperties } = require('expo/config-plugins');

// No signing values enter generated files. Only the local build process supplies them.
const signing = `
    signingConfigs {
        othermeRelease {
            def signingPath = System.getenv('OTHERME_SIGNING_STORE_FILE')
            if (signingPath) storeFile file(signingPath)
            storePassword System.getenv('OTHERME_SIGNING_PASSWORD')
            keyAlias System.getenv('OTHERME_SIGNING_KEY_ALIAS')
            keyPassword System.getenv('OTHERME_SIGNING_PASSWORD')
            storeType 'PKCS12'
        }
    }
`;
function configureSigning(contents) {
  if (contents.includes('signingConfigs.othermeRelease')) return contents;
  const release = /release \{([\s\S]*?)signingConfig signingConfigs\.debug/;
  if (!release.test(contents)) throw new Error('Expo release signing template changed. Refusing debug signing.');
  return contents.replace('react {', `react {\n    nodeExecutableAndArgs = ["node", new File(projectRoot, "../../scripts/mobile-node.cjs").absolutePath]`)
    .replace('    signingConfigs {', signing + '    signingConfigs {')
    .replace(release, 'release {$1signingConfig signingConfigs.othermeRelease');
}
module.exports = function withOthermeRelease(config) {
  config = withAppBuildGradle(config, mod => {
    mod.modResults.contents = configureSigning(mod.modResults.contents);
    return mod;
  });
  config = withProjectBuildGradle(config, mod => {
    // pnpm's nested package paths exceed Windows CreateProcess limits for prefab .bat files.
    const marker = '// Otherme project-local native outputs';
    const outputs = `
${marker}
subprojects { p ->
    p.layout.buildDirectory.set(new File(rootProject.projectDir, "../../../.runtime/native/" + p.name))
    // Autolinking and library CMake files both assume this codegen location.
    p.tasks.configureEach { task ->
        if (task.name == "generateCodegenArtifactsFromSchema") {
            def nativeCodegen = new File(p.projectDir, "build/generated/source/codegen")
            task.outputs.dir(nativeCodegen)
            task.doLast {
                p.copy {
                    from(new File(p.layout.buildDirectory.get().asFile, "generated/source/codegen"))
                    into(nativeCodegen)
                }
            }
        }
    }
    ["com.android.library", "com.android.application"].each { id ->
        p.plugins.withId(id) {
            p.android.externalNativeBuild.cmake.buildStagingDirectory = new File(rootProject.projectDir, "../../../.runtime/cxx/" + Integer.toHexString(p.path.hashCode())).canonicalFile
        }
    }
}
// End Otherme native outputs
`;
    // React's root plugin evaluates the app, so install these hooks before applying it.
    mod.modResults.contents = mod.modResults.contents.replace(/\n\/\/ Otherme project-local native outputs[\s\S]*?\/\/ End Otherme native outputs\n/g, '');
    mod.modResults.contents = mod.modResults.contents.replace('apply plugin: "expo-root-project"', outputs+'\napply plugin: "expo-root-project"');
    return mod;
  });
  config = withGradleProperties(config, mod => {
    for (const [key, value] of Object.entries({
      'android.builder.sdkDownload': 'false',
      'org.gradle.java.installations.auto-download': 'false',
      'EX_DEV_CLIENT_NETWORK_INSPECTOR': 'false',
    })) {
      mod.modResults = mod.modResults.filter(item => item.key !== key);
      mod.modResults.push({ type: 'property', key, value });
    }
    return mod;
  });
  return withAndroidManifest(config, mod => {
    const application = mod.modResults.manifest.application[0].$;
    // Personal-use authenticated HTTP on trusted Wi-Fi, not an internet deployment.
    application['android:usesCleartextTraffic'] = 'true';
    application['android:allowBackup'] = 'false';
    return mod;
  });
};
module.exports.configureSigning = configureSigning;
