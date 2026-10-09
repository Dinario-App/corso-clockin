package app.corso.securestoreabsence

import android.preference.PreferenceManager
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File

/**
 * Android half of the imported-words disk guard.
 *
 * `observe` reports whether any of the SecureStore locations for [keys] still holds
 * an entry on disk, as PRESENT / ABSENT / CANNOT_OBSERVE. It never reads, returns or
 * logs a value: [AbsenceObserver] parses entry names only and uses no key, so it
 * cannot trigger a biometric prompt.
 *
 * It is only called when the build flag EXPO_PUBLIC_FLAG_SECURESTORE_DISK_GUARD is on.
 */
class SecureStoreAbsenceModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("CorsoSecureStoreAbsence")

    AsyncFunction("observe") { keys: List<String>, keychainService: String ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      // ContextImpl.getPreferencesDir(): the directory every SharedPreferences
      // file of this app lives in, SecureStore.xml included.
      val dir = File(context.applicationInfo.dataDir, "shared_prefs")
      // The same name SecureStore's delete clears through
      // PreferenceManager.getDefaultSharedPreferences(reactContext).
      val defaultPrefsName = PreferenceManager.getDefaultSharedPreferencesName(context)
      val locations = keys.flatMap { secureStoreLocations(it, keychainService, defaultPrefsName) }
      val observation = AbsenceObserver.observeAll(dir, locations)
      val seen = when (observation.seen) {
        Seen.PRESENT -> "PRESENT"
        Seen.ABSENT -> "ABSENT"
        Seen.UNKNOWN -> "CANNOT_OBSERVE"
      }
      mapOf("seen" to seen, "why" to observation.why)
    }
  }
}
