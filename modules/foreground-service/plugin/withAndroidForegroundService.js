/**
 * Expo Config Plugin — withAndroidForegroundService
 *
 * Injects into AndroidManifest.xml:
 *   • FOREGROUND_SERVICE permission
 *   • FOREGROUND_SERVICE_MICROPHONE permission  (Android 14+)
 *   • AdamsListeningService <service> declaration
 *
 * Run automatically via expo prebuild when this plugin is listed in app.json.
 */

const { withAndroidManifest } = require("@expo/config-plugins");

/**
 * @param {import('@expo/config-plugins').ExpoConfig} config
 */
function withAndroidForegroundService(config) {
  return withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults;
    const app = manifest.manifest.application?.[0];
    if (!app) return mod;

    // ── Permissions ──────────────────────────────────────────────────────────
    const usesPermissions = manifest.manifest["uses-permission"] ?? [];

    const requiredPermissions = [
      "android.permission.FOREGROUND_SERVICE",
      "android.permission.FOREGROUND_SERVICE_MICROPHONE",
      "android.permission.RECEIVE_BOOT_COMPLETED",   // restart on reboot
    ];

    for (const perm of requiredPermissions) {
      if (!usesPermissions.some((p) => p.$?.["android:name"] === perm)) {
        usesPermissions.push({ $: { "android:name": perm } });
      }
    }
    manifest.manifest["uses-permission"] = usesPermissions;

    // ── Service declaration ───────────────────────────────────────────────────
    const services = app.service ?? [];
    const serviceName = "expo.modules.adamsforeground.AdamsListeningService";

    if (!services.some((s) => s.$?.["android:name"] === serviceName)) {
      services.push({
        $: {
          "android:name":       serviceName,
          "android:enabled":    "true",
          "android:exported":   "false",
          // Required on Android 14 (API 34) to declare the foreground service type
          "android:foregroundServiceType": "microphone",
        },
        // Boot receiver — restarts service after device reboot
        "intent-filter": [
          {
            action: [{ $: { "android:name": "android.intent.action.BOOT_COMPLETED" } }],
          },
        ],
      });
    }
    app.service = services;

    return mod;
  });
}

module.exports = withAndroidForegroundService;
