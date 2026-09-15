import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/api_client.dart';
import '../services/app_state.dart';

class ConnectScreen extends StatefulWidget {
  const ConnectScreen({super.key});

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  final _controller = TextEditingController(text: 'http://192.168.1.');
  bool _loading = false;
  String? _error;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  Future<void> _connect() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await context.read<AppState>().connect(_controller.text);
    } on ApiException catch (e) {
      setState(() => _error = e.message);
    } catch (e) {
      setState(() => _error = 'حدث خطأ غير متوقع. حاول مرة أخرى.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(Icons.wifi_tethering, size: 56, color: Color(0xFF14B8A6)),
                const SizedBox(height: 16),
                const Text(
                  'الاتصال بجهاز المعلم',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: Colors.white),
                ),
                const SizedBox(height: 8),
                const Text(
                  'تأكد إنك على نفس شبكة الواي فاي مع اللابتوب، ثم أدخل عنوانه',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70, fontSize: 13),
                ),
                const SizedBox(height: 24),
                TextField(
                  controller: _controller,
                  textDirection: TextDirection.ltr,
                  textAlign: TextAlign.left,
                  keyboardType: TextInputType.url,
                  decoration: const InputDecoration(hintText: 'http://192.168.x.x:8000'),
                ),
                if (_error != null) ...[
                  const SizedBox(height: 12),
                  Text(_error!, style: const TextStyle(color: Color(0xFFEF4444)), textAlign: TextAlign.center),
                ],
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: _loading ? null : _connect,
                    child: _loading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : const Text('اتصال'),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
