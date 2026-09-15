// shared_preferences-backed equivalent of mobile/js/mobile-db.js's
// IndexedDB wrapper. Kept deliberately simple (a handful of JSON-string
// keys) rather than a real embedded database — see the plan file for why
// (avoids a native SQLite plugin's build risk; a teacher's roster is a
// small enough JSON blob that this is plenty).
import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';

class QueuedChange {
  final int id;
  final String classId;
  final String studentId;
  final String periodId;
  final String subjectId;
  final String categoryId;
  final String kind; // 'numeric' | 'dot' | 'participation'
  final int? index;
  final dynamic value;
  final int? arrayLength;
  final int clientTimestamp;

  QueuedChange({
    required this.id,
    required this.classId,
    required this.studentId,
    required this.periodId,
    required this.subjectId,
    required this.categoryId,
    required this.kind,
    this.index,
    required this.value,
    this.arrayLength,
    required this.clientTimestamp,
  });

  factory QueuedChange.fromJson(Map<String, dynamic> json) => QueuedChange(
        id: json['id'] as int,
        classId: json['classId'] as String,
        studentId: json['studentId'] as String,
        periodId: json['periodId'] as String,
        subjectId: json['subjectId'] as String,
        categoryId: json['categoryId'] as String,
        kind: json['kind'] as String,
        index: json['index'] as int?,
        value: json['value'],
        arrayLength: json['arrayLength'] as int?,
        clientTimestamp: json['clientTimestamp'] as int,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'classId': classId,
        'studentId': studentId,
        'periodId': periodId,
        'subjectId': subjectId,
        'categoryId': categoryId,
        'kind': kind,
        'index': index,
        'value': value,
        'arrayLength': arrayLength,
        'clientTimestamp': clientTimestamp,
      };
}

class LocalStore {
  static const _kRoster = 'roster';
  static const _kConfig = 'config';
  static const _kLastSyncedAt = 'lastSyncedAt';
  static const _kLastKnownServerVersion = 'lastKnownServerVersion';
  static const _kChangeQueue = 'changeQueue';
  static const _kNextChangeId = 'nextChangeId';

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

  Future<Map<String, dynamic>?> getConfig() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_kConfig);
    if (raw == null) return null;
    return (jsonDecode(raw) as Map).cast<String, dynamic>();
  }

  Future<void> setConfig({required String laptopUrl, required String deviceId}) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kConfig, jsonEncode({'laptopUrl': laptopUrl, 'deviceId': deviceId}));
  }

  Future<void> setLastSyncedAt(int ts) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_kLastSyncedAt, ts);
  }

  Future<int?> getLastKnownServerVersion() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_kLastKnownServerVersion);
  }

  Future<void> setLastKnownServerVersion(int version) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_kLastKnownServerVersion, version);
  }

  Future<int> queueChange(Map<String, dynamic> changeWithoutId) async {
    final prefs = await SharedPreferences.getInstance();
    final nextId = (prefs.getInt(_kNextChangeId) ?? 1);
    final list = await listQueuedChangesRaw(prefs);
    list.add({...changeWithoutId, 'id': nextId});
    await prefs.setString(_kChangeQueue, jsonEncode(list));
    await prefs.setInt(_kNextChangeId, nextId + 1);
    return nextId;
  }

  Future<List<Map<String, dynamic>>> listQueuedChangesRaw(SharedPreferences prefs) async {
    final raw = prefs.getString(_kChangeQueue);
    if (raw == null) return [];
    return (jsonDecode(raw) as List).map((e) => (e as Map).cast<String, dynamic>()).toList();
  }

  Future<List<QueuedChange>> listQueuedChanges() async {
    final prefs = await SharedPreferences.getInstance();
    final list = await listQueuedChangesRaw(prefs);
    return list.map(QueuedChange.fromJson).toList();
  }

  Future<void> removeQueuedChanges(List<int> ids) async {
    if (ids.isEmpty) return;
    final prefs = await SharedPreferences.getInstance();
    final list = await listQueuedChangesRaw(prefs);
    list.removeWhere((c) => ids.contains(c['id'] as int));
    await prefs.setString(_kChangeQueue, jsonEncode(list));
  }
}
