import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../services/app_state.dart';

/// Mirrors mobile/mobile.css's .sync-status-chip states. Tapping always
/// fires an immediate sync attempt, same as the web version's chip.
class SyncStatusChip extends StatelessWidget {
  const SyncStatusChip({super.key});

  @override
  Widget build(BuildContext context) {
    final state = context.watch<AppState>();
    final (label, color, icon) = switch (state.syncStatus) {
      SyncStatus.idle => ('متصل', const Color(0xFF10B981), Icons.check_circle_outline),
      SyncStatus.pending => ('${state.pendingChangeCount} تغييرات بانتظار المزامنة', const Color(0xFFF59E0B), Icons.schedule),
      SyncStatus.syncing => ('جارٍ المزامنة...', const Color(0xFF6366F1), Icons.sync),
      SyncStatus.error => ('تعذر الاتصال بجهاز المعلم', const Color(0xFFEF4444), Icons.wifi_off),
    };
    return InkWell(
      onTap: () => context.read<AppState>().triggerSync(),
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: color.withOpacity(0.35)),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: color),
            const SizedBox(width: 4),
            Text(label, style: TextStyle(color: color, fontSize: 11, fontWeight: FontWeight.bold)),
          ],
        ),
      ),
    );
  }
}
