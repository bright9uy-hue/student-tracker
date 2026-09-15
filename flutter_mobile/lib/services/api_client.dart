// Talks to the exact same 3 endpoints already built and proven on
// server.js for the /mobile/ web version (see the plan file) — nothing
// server-side changes for this Flutter client, it's plain HTTP+JSON.
import 'dart:convert';
import 'package:http/http.dart' as http;

class ApiException implements Exception {
  final String message;
  ApiException(this.message);
  @override
  String toString() => message;
}

class MobileApiClient {
  static String _clean(String url) {
    var u = url.trim();
    while (u.endsWith('/')) {
      u = u.substring(0, u.length - 1);
    }
    return u;
  }

  /// GET /api/mobile/roster — first-run seed / full refresh.
  static Future<Map<String, dynamic>> fetchRoster(String laptopUrl) async {
    final url = _clean(laptopUrl);
    if (url.isEmpty) throw ApiException('أدخل عنوان جهاز اللابتوب.');
    http.Response res;
    try {
      res = await http
          .get(Uri.parse('$url/api/mobile/roster'))
          .timeout(const Duration(seconds: 6));
    } catch (e) {
      throw ApiException('تعذر الوصول لهذا العنوان. تأكد إنك على نفس شبكة الواي فاي مع اللابتوب.');
    }
    if (res.statusCode != 200) {
      throw ApiException('رد الجهاز بخطأ (رمز ${res.statusCode}).');
    }
    return (jsonDecode(utf8.decode(res.bodyBytes)) as Map).cast<String, dynamic>();
  }

  /// GET /api/mobile/version — cheap reachability + staleness probe.
  static Future<int?> fetchVersion(String laptopUrl) async {
    final url = _clean(laptopUrl);
    try {
      final res = await http
          .get(Uri.parse('$url/api/mobile/version'))
          .timeout(const Duration(seconds: 3));
      if (res.statusCode != 200) return null;
      final body = jsonDecode(utf8.decode(res.bodyBytes)) as Map;
      return (body['version'] as num).toInt();
    } catch (e) {
      return null;
    }
  }

  /// POST /api/mobile/sync — pushes queued changes, pulls the fresh roster
  /// back in the same round-trip.
  static Future<Map<String, dynamic>> sync({
    required String laptopUrl,
    required String deviceId,
    required List<Map<String, dynamic>> changes,
  }) async {
    final url = _clean(laptopUrl);
    final res = await http
        .post(
          Uri.parse('$url/api/mobile/sync'),
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'deviceId': deviceId, 'changes': changes}),
        )
        .timeout(const Duration(seconds: 8));
    if (res.statusCode != 200) {
      throw ApiException('sync http ${res.statusCode}');
    }
    return (jsonDecode(utf8.decode(res.bodyBytes)) as Map).cast<String, dynamic>();
  }
}
