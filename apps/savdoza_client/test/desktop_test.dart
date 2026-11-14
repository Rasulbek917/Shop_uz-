import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:savdoza_client/data.dart';
import 'package:savdoza_client/desktop_shell.dart';
import 'package:savdoza_client/desktop_table.dart';
import 'package:savdoza_client/navigation.dart';

void main() {
  for (final width in [900.0, 1280.0]) {
    testWidgets('desktop menus switch sections and exit focus mode at $width', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = Size(width, 800);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final data = AppData(store: DeviceStore(desktop: false));
      final expires = DateTime.now().add(const Duration(days: 2));
      final token = base64Url
          .encode(
            utf8.encode(
              jsonEncode({'exp': expires.millisecondsSinceEpoch ~/ 1000}),
            ),
          )
          .replaceAll('=', '');
      data.api.cookie = 'savdoza_auth_token=header.$token.signature';
      data.session = {
        'account': {
          'user': {
            'role': 'SHOP_ADMIN',
            'planCode': 'PRO',
            'hasAccess': true,
            'subscriptionEndDate': expires.toIso8601String(),
            'username': 'owner',
            'shopName': 'Savdoza do‘koni',
          },
        },
      };
      const destinations = [
        Destination('dashboard', 'Ish stoli', Icons.dashboard),
        Destination('pos', 'POS', Icons.point_of_sale),
        Destination('products', 'Mahsulotlar', Icons.inventory),
        Destination('staff', 'Xodimlar', Icons.people, max: true),
        Destination('settings', 'Sozlamalar', Icons.settings),
        Destination('queue', 'Sinxronlash', Icons.sync),
      ];
      String section = 'dashboard';
      await tester.pumpWidget(
        MaterialApp(
          home: StatefulBuilder(
            builder: (context, update) => DesktopShell(
              data: data,
              destinations: destinations,
              section: section,
              onNavigate: (value) => update(() => section = value),
              onLogout: () {},
              child: Center(child: Text('Content:$section')),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.tap(find.text('Ma’lumotlar'));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(MenuItemButton, 'Mahsulotlar'));
      await tester.pumpAndSettle();
      expect(find.text('Content:products'), findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.f11);
      await tester.pumpAndSettle();
      expect(find.byType(MenuBar), findsNothing);
      expect(find.text('Content:products'), findsOneWidget);
      await tester.sendKeyEvent(LogicalKeyboardKey.escape);
      await tester.pumpAndSettle();
      expect(find.byType(MenuBar), findsOneWidget);
      await tester.tap(find.byTooltip('Menyuni yig‘ish / ochish'));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
      data.api.client.close();
      data.dispose();
    });
  }
  testWidgets(
    'desktop catalogue paginates a thousand records without building all rows',
    (tester) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = const Size(1280, 900);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final rows = List.generate(
        1000,
        (i) => <String, dynamic>{
          'id': '$i',
          'name': 'Product $i',
          'salePrice': 10000,
        },
      );
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: DesktopRecordsTable(
              rows: rows,
              title: 'Mahsulotlar',
              actions: (_) => const SizedBox(),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(find.text('Product 0'), findsOneWidget);
      expect(find.text('Product 999'), findsNothing);
      await tester.ensureVisible(find.byTooltip('Next page'));
      await tester.tap(find.byTooltip('Next page'));
      await tester.pumpAndSettle();
      expect(find.text('Product 20'), findsOneWidget);
      expect(tester.takeException(), isNull);
      await tester.pumpWidget(const SizedBox());
    },
  );
}
