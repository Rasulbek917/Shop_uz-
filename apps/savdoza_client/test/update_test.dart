import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:savdoza_client/password_field.dart';
import 'package:savdoza_client/updates.dart';

void main() {
  final manifest = <String, dynamic>{
    'version': '2.0.0+15',
    'bytes': 68000000,
    'sha256': List.filled(64, 'a').join(),
    'url': 'https://github.com/Rasulbek917/Shop_uz-/releases/download/android-latest/savdoza-android.apk',
  };
  test('updates require the official APK, checksum and bounded size', () {
    expect(AppRelease.fromJson(manifest).build, 15);
    final windows = {
      ...manifest,
      'url': 'https://github.com/Rasulbek917/Shop_uz-/releases/download/windows-latest/savdoza-windows-setup.exe',
    };
    expect(AppRelease.fromJson(windows, platform: 'windows').build, 15);
    expect(
      () => AppRelease.fromJson(manifest, platform: 'windows'),
      throwsA(isA<FormatException>()),
    );
    expect(() => AppRelease.fromJson(windows), throwsA(isA<FormatException>()));
    for (final invalid in [
      {
        'url': 'http://github.com/Rasulbek917/Shop_uz-/releases/download/android-latest/savdoza-android.apk',
      },
      {'url': 'https://github.com/another/app.apk'},
      {'url': 'https://github.com.evil.example/app.apk'},
      {'sha256': 'bad'},
      {'bytes': 300000000},
      {'bytes': 0},
      {'version': '2.0.0+0'},
    ]) {
      expect(
        () => AppRelease.fromJson({...manifest, ...invalid}),
        throwsA(isA<FormatException>()),
      );
    }
    final updates = AppUpdates()..build = 15;
    updates.release = AppRelease.fromJson(manifest);
    expect(updates.available, false);
    updates.build = 14;
    expect(updates.available, true);
    updates.build = 16;
    expect(updates.available, false);
    updates.dispose();
  });
  testWidgets('password eye preserves text while showing and hiding it', (
    tester,
  ) async {
    final controller = TextEditingController(text: 'TestPassword!');
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: PasswordField(controller: controller, label: 'Parol'),
        ),
      ),
    );
    expect(
      tester.widget<EditableText>(find.byType(EditableText)).obscureText,
      true,
    );
    await tester.tap(find.byTooltip('Parolni ko‘rsatish'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<EditableText>(find.byType(EditableText)).obscureText,
      false,
    );
    expect(controller.text, 'TestPassword!');
    await tester.tap(find.byTooltip('Parolni yashirish'));
    await tester.pumpAndSettle();
    expect(
      tester.widget<EditableText>(find.byType(EditableText)).obscureText,
      true,
    );
    await tester.pumpWidget(const SizedBox());
    controller.dispose();
  });
}
