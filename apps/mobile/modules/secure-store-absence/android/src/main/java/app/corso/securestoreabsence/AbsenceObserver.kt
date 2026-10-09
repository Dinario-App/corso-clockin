// Observes whether expo-secure-store's Android storage still holds an item, by
// reading the durable preferences files rather than the in-process map that a
// failed delete has already cleared. Uses only the JVM and public Android APIs.
//
// It depends on expo-secure-store's private storage layout, so it must be
// re-checked whenever expo-secure-store is upgraded.
package app.corso.securestoreabsence

import android.util.Xml
import org.xmlpull.v1.XmlPullParser
import java.io.File

enum class Seen { PRESENT, ABSENT, UNKNOWN }

data class Observation(val seen: Seen, val why: String)

enum class Verdict { REMOVED, NOTHING_TO_REMOVE, NOT_REMOVED, ABSENT_ORIGIN_UNKNOWN, CANNOT_TELL }

/** One SharedPreferences file and the entry names in it that hold the item. */
data class Location(val fileName: String, val entryNames: Set<String>)

/**
 * The locations expo-secure-store's Android delete removes for [key]
 * (deleteItemImpl / removeItem, 57.0.1 and 57.0.4): the keychain-aware and the
 * bare entry in "SecureStore", and the bare entry in the default preferences.
 */
fun secureStoreLocations(key: String, keychainService: String, defaultPrefsName: String) = listOf(
  Location("SecureStore", setOf("$keychainService-$key", key)),
  Location(defaultPrefsName, setOf(key)),
)

object AbsenceObserver {
  /**
   * Reads the durable files, never the in-process map. The map is what a failed
   * commit has already changed (expo/expo#48989), so any read through
   * SharedPreferences - and so through SecureStore - cannot see past it.
   *
   * Mirrors the one loader rule that changes the answer: if NAME.xml.bak exists,
   * SharedPreferencesImpl.loadFromDisk discards NAME.xml and restores the backup,
   * so the backup is what the next process reads. Strictly read-only: it never
   * performs that rename itself.
   *
   * UNKNOWN, never ABSENT, when it cannot list, read or fully parse what the loader
   * would read. The loader turns an unreadable or unparseable file into an empty
   * map, which is why a reload is not an absence check either.
   */
  fun observe(dir: File, location: Location): Observation {
    val listing = dir.list()
      ?: return if (dir.parentFile?.list()?.contains(dir.name) == false) {
        Observation(Seen.ABSENT, "no preferences directory")
      } else {
        Observation(Seen.UNKNOWN, "cannot list ${dir.name}")
      }
    val main = "${location.fileName}.xml"
    val backup = "$main.bak"
    val effective = when {
      backup in listing -> File(dir, backup)
      main in listing -> File(dir, main)
      else -> return Observation(Seen.ABSENT, "no $main and no $backup")
    }
    val bytes = try {
      effective.readBytes()
    } catch (e: Exception) {
      return Observation(Seen.UNKNOWN, "cannot read ${effective.name}: ${e.javaClass.simpleName}")
    }
    val names = try {
      entryNames(bytes)
    } catch (e: Exception) {
      return Observation(Seen.UNKNOWN, "cannot parse ${effective.name}: ${e.javaClass.simpleName}")
    }
    val held = location.entryNames.filter { it in names }
    return if (held.isEmpty()) {
      Observation(Seen.ABSENT, "${effective.name} parsed, ${names.size} entries, none of ${location.entryNames.size}")
    } else {
      Observation(Seen.PRESENT, "${effective.name} holds ${held.size} of the entries")
    }
  }

  /** PRESENT if any location holds it; else UNKNOWN if any could not be read; else ABSENT. */
  fun observeAll(dir: File, locations: List<Location>): Observation {
    val all = locations.map { observe(dir, it) }
    return all.firstOrNull { it.seen == Seen.PRESENT }
      ?: all.firstOrNull { it.seen == Seen.UNKNOWN }
      ?: Observation(Seen.ABSENT, all.joinToString("; ") { it.why })
  }

  /** Entry names of a SharedPreferences XML map. Anything but a complete <map> throws. */
  private fun entryNames(bytes: ByteArray): Set<String> {
    val parser = Xml.newPullParser()
    parser.setInput(bytes.inputStream(), "UTF-8")
    val names = mutableSetOf<String>()
    var depth = 0
    var sawMap = false
    while (true) {
      when (parser.next()) {
        XmlPullParser.START_TAG -> {
          depth += 1
          if (depth == 1) {
            require(parser.name == "map") { "root is not <map>" }
            sawMap = true
          } else if (depth == 2) {
            names += requireNotNull(parser.getAttributeValue(null, "name")) { "entry without a name" }
          }
        }
        XmlPullParser.END_TAG -> depth -= 1
        XmlPullParser.END_DOCUMENT -> {
          require(sawMap && depth == 0) { "incomplete document" }
          return names
        }
      }
    }
  }
}

/**
 * Deleted, never written and read-failed all look like "nothing there" to a
 * single read. Telling them apart needs an observation BEFORE the delete and one
 * after, both of the durable store.
 */
fun verdict(before: Seen, after: Seen): Verdict = when {
  after == Seen.PRESENT -> Verdict.NOT_REMOVED
  after == Seen.UNKNOWN -> Verdict.CANNOT_TELL
  before == Seen.PRESENT -> Verdict.REMOVED
  before == Seen.ABSENT -> Verdict.NOTHING_TO_REMOVE
  else -> Verdict.ABSENT_ORIGIN_UNKNOWN
}
