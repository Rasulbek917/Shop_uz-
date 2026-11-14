import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:savdoza_client/desktop_shell.dart';
import 'package:savdoza_client/desktop_table.dart';
import 'package:savdoza_client/navigation.dart';
import 'package:savdoza_client/pos.dart';

import 'app_test.dart' show sample;
import 'dashboard_test.dart' show dashboardData;

void main() {
  for (final section in ['dashboard', 'pos', 'products']) {
    testWidgets('desktop $section layout uses the available workspace', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1280, 900);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final font = FontLoader('SavdozaPreview')
        ..addFont(
          Future.value(
            ByteData.sublistView(
              File('../../public/fonts/receipt.ttf').readAsBytesSync(),
            ),
          ),
        );
      await tester.runAsync(font.load);
      final data = sample();
      final statistics = dashboardData();
      data.cache['reports'] = statistics.cache['reports'];
      statistics.api.client.close();
      statistics.dispose();
      data.session!['account']['user'].addAll({
        'fullName': 'Rasulbek',
        'shopName': 'Savdoza do‘koni',
      });
      final boundary = GlobalKey();
      final content = switch (section) {
        'dashboard' => DesktopDashboard(data: data, onNavigate: (_) {}),
        'pos' => PosPage(data: data),
        _ => DesktopRecordsTable(
          rows: data.products,
          title: 'Mahsulotlar',
          section: 'products',
          actions: (_) =>
              TextButton(onPressed: () {}, child: const Text('Tahrirlash')),
        ),
      };
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            fontFamily: 'SavdozaPreview',
            colorSchemeSeed: const Color(0xff24634f),
            inputDecorationTheme: const InputDecorationTheme(
              border: OutlineInputBorder(),
            ),
          ),
          home: RepaintBoundary(
            key: boundary,
            child: DesktopShell(
              data: data,
              destinations: const [
                Destination('dashboard', 'Dashboard', Icons.dashboard_outlined),
                Destination('pos', 'POS terminal', Icons.point_of_sale),
                Destination(
                  'products',
                  'Mahsulotlar',
                  Icons.inventory_2_outlined,
                ),
                Destination('settings', 'Sozlamalar', Icons.settings_outlined),
              ],
              section: section,
              onNavigate: (_) {},
              onLogout: () {},
              child: content,
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      if (section == 'pos') {
        final basket = tester.getTopLeft(find.text('Savat'));
        expect(basket.dx, greaterThan(850));
        expect(basket.dy, lessThan(220));
        await tester.tap(find.text('Sut'));
        await tester.pumpAndSettle();
        final checkout = find.widgetWithText(FilledButton, 'Savdoni yakunlash');
        expect(tester.getBottomRight(checkout).dy, greaterThan(720));
        expect(tester.widget<FilledButton>(checkout).onPressed, isNotNull);
      }
      if (section == 'products') {
        expect(find.text('Shtrix-kod'), findsOneWidget);
        expect(
          tester.getSize(find.byType(PaginatedDataTable)).height,
          lessThan(400),
        );
      }
      if (section == 'dashboard') {
        expect(find.text('Oxirgi 7 kunlik savdo grafigi'), findsOneWidget);
      }
      expect(tester.takeException(), isNull);
      if (Platform.environment['SAVDOZA_DESKTOP_PREVIEW'] == '1') {
        await tester.runAsync(() async {
          final image =
              await (boundary.currentContext!.findRenderObject()
                      as RenderRepaintBoundary)
                  .toImage();
          final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
          // These previews contain the isolated fixture data above.
          final encoded = base64Encode(bytes!.buffer.asUint8List());
          for (var offset = 0; offset < encoded.length; offset += 16000) {
            final end = offset + 16000 < encoded.length
                ? offset + 16000
                : encoded.length;
            print(
              'SAVDOZA_UI_${section}_$offset=${encoded.substring(offset, end)}',
            );
          }
          image.dispose();
        });
      }
      await tester.pumpWidget(const SizedBox());
      data.api.client.close();
      data.dispose();
    });
  }
}
