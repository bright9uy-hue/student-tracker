// shared_preferences-backed persistence for the standalone app. The
// laptop-paired version of this file also carried a change queue and
// server-sync bookkeeping (config/laptopUrl/deviceId, lastKnownServerVersion,
// changeQueue) - none of that applies once the phone is the sole source of
// truth, so this is now just "read/write the roster blob" plus teacher
// settings.
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class LocalStore {
  static const _kRoster = 'roster';
  static const _kTeacherSettings = 'teacherSettings';

  Future<Map<String, dynamic>?> getRoster() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_kRoster);
    if (raw == null) return null;
    return (jsonDecode(raw) as Map).cast<String, dynamic>();
  }

  Future<void> setRoster(Map<String, dynamic> roster) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kRoster, jsonEncode(roster));
  }

  Future<Map<String, dynamic>?> getTeacherSettings() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_kTeacherSettings);
    if (raw == null) return null;
    return (jsonDecode(raw) as Map).cast<String, dynamic>();
  }

  Future<void> setTeacherSettings(Map<String, dynamic> settings) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kTeacherSettings, jsonEncode(settings));
  }
}
