import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'services/app_state.dart';
import 'screens/classes_screen.dart';
import 'screens/grading_screen.dart';

void main() {
  runApp(const StudentTrackerMobileApp());
}

class StudentTrackerMobileApp extends StatelessWidget {
  const StudentTrackerMobileApp({super.key});

  @override
  Widget build(BuildContext context) {
    return ChangeNotifierProvider(
      create: (_) => AppState()..init(),
      child: MaterialApp(
        title: 'متابع الطلاب - الجوال',
        debugShowCheckedModeBanner: false,
        locale: const Locale('ar'),
        theme: _buildTheme(),
        home: const AppRoot(),
      ),
    );
  }

  ThemeData _buildTheme() {
    const teal = Color(0xFF14B8A6);
    const bg = Color(0xFF0F172A);
    const surface = Color(0xFF1E293B);
    return ThemeData(
      // The reference web app references 'Tajawal' in its CSS but never
      // actually loads it (no <link>/@font-face anywhere in index.html),
      // so it silently falls back to the browser default there too —
      // matching that (Flutter's own default, which renders Arabic fine)
      // rather than bundling a font file to back a family name nothing
      // here actually ships.
      brightness: Brightness.dark,
      useMaterial3: true,
      scaffoldBackgroundColor: bg,
      colorScheme: const ColorScheme.dark(
        primary: teal,
        secondary: teal,
        surface: surface,
      ),
      appBarTheme: const AppBarTheme(
        backgroundColor: bg,
        foregroundColor: Colors.white,
        elevation: 0,
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: teal,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: surface,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: BorderSide.none,
        ),
        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      ),
    );
  }
}

class AppRoot extends StatelessWidget {
  const AppRoot({super.key});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.rtl,
      child: Consumer<AppState>(
        builder: (context, state, _) {
          switch (state.currentScreen) {
            case AppScreen.classes:
              return const ClassesScreen();
            case AppScreen.grading:
              return const GradingScreen();
          }
        },
      ),
    );
  }
}
