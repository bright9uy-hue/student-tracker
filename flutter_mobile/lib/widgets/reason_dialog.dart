import 'package:flutter/material.dart';

/// Ported from ReasonModal.js: 3 fixed reasons + a custom-text option.
/// Returns the chosen reason string, or null if cancelled (in which case
/// the caller must leave the dot exactly as it was — see AppState.onDotClick).
Future<String?> showReasonDialog(BuildContext context) {
  return showDialog<String>(
    context: context,
    builder: (context) => const _ReasonDialogContent(),
  );
}

class _ReasonDialogContent extends StatefulWidget {
  const _ReasonDialogContent();

  @override
  State<_ReasonDialogContent> createState() => _ReasonDialogContentState();
}

class _ReasonDialogContentState extends State<_ReasonDialogContent> {
  bool _customOpen = false;
  final _customController = TextEditingController();

  @override
  void dispose() {
    _customController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      backgroundColor: const Color(0xFF1E1B4B),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Row(
              children: [
                Icon(Icons.remove_circle_outline, color: Color(0xFFEF4444)),
                SizedBox(width: 8),
                Expanded(
                  child: Text(
                    'سبب الخصم من المشاركة',
                    style: TextStyle(color: Color(0xFFEF4444), fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            const Text(
              'اختر سبب الخصم لتحويل النقطة إلى حمراء (خصم درجة واحدة):',
              style: TextStyle(color: Colors.white70, fontSize: 13),
            ),
            const SizedBox(height: 14),
            _reasonButton('نائم', Icons.bedtime_outlined),
            const SizedBox(height: 10),
            _reasonButton('التحدث أثناء الدرس', Icons.chat_bubble_outline),
            const SizedBox(height: 10),
            _reasonButton('عدم الكتابة', Icons.edit_note_outlined),
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => setState(() => _customOpen = !_customOpen),
              icon: const Icon(Icons.edit_outlined, size: 18),
              label: const Text('سبب مخصص...'),
              style: OutlinedButton.styleFrom(
                foregroundColor: Colors.white,
                side: const BorderSide(color: Color(0x33EF4444)),
                padding: const EdgeInsets.symmetric(vertical: 12),
              ),
            ),
            if (_customOpen) ...[
              const SizedBox(height: 10),
              TextField(
                controller: _customController,
                decoration: const InputDecoration(hintText: 'مثال: عدم إحضار الكتاب...'),
                onSubmitted: (_) => _submitCustom(),
              ),
              const SizedBox(height: 8),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton(
                  onPressed: _submitCustom,
                  style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
                  child: const Text('تأكيد الخصم'),
                ),
              ),
            ],
            const SizedBox(height: 16),
            TextButton(
              onPressed: () => Navigator.of(context).pop(null),
              child: const Text('إلغاء (إبقاء النقطة إيجابية)'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _reasonButton(String label, IconData icon) {
    return OutlinedButton.icon(
      onPressed: () => Navigator.of(context).pop(label),
      icon: Icon(icon, size: 18, color: const Color(0xFFEF4444)),
      label: Text(label, style: const TextStyle(color: Colors.white)),
      style: OutlinedButton.styleFrom(
        alignment: Alignment.centerRight,
        side: const BorderSide(color: Color(0x40EF4444)),
        backgroundColor: const Color(0x14EF4444),
        padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
      ),
    );
  }

  void _submitCustom() {
    final text = _customController.text.trim();
    Navigator.of(context).pop(text.isEmpty ? 'سبب مخصص' : text);
  }
}
