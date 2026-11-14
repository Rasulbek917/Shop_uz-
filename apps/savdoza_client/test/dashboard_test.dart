import 'dart:io';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:savdoza_client/dashboard.dart';
import 'package:savdoza_client/data.dart';

AppData dashboardData() {
  final data = AppData();
  data.session = {
    'scope': 'dashboard-test',
    'account': {
      'user': {
        'role': 'SHOP_ADMIN',
        'planCode': 'PRO',
        'fullName': 'Rasulbek',
        'shopName': 'Savdoza do‘koni',
      },
    },
  };
  data.cache['reports'] = {
    'today': {'revenue': 1250000, 'salesCount': 24, 'profit': 325000},
    'inventory': {
      'totalProductsCount': 148,
      'lowStockCount': 8,
      'approachingExpiryCount': 3,
    },
    'last7DaysTrend': [
      for (var i = 0; i < 7; i++)
        {
          'label': '${i + 8}.11',
          'revenue': [120000, 0, 350000, 280000, 480000, 375000, 650000][i],
          'count': i + 2,
        },
    ],
    'topProducts': [
      {
        'name': 'Sut 1 litr',
        'totalQuantity': 32,
        'unit': 'dona',
        'totalRevenue': 384000,
      },
      {
        'name': 'Non',
        'totalQuantity': 48,
        'unit': 'dona',
        'totalRevenue': 192000,
      },
    ],
    'cashiersStats': [
      {
        'fullName': 'Aziza Karimova',
        'username': 'aziza',
        'salesCount': 24,
        'totalItemsSold': 56,
        'totalRevenue': 1250000,
      },
    ],
  };
  return data;
}

void main() {
  for (final width in [320.0, 390.0, 800.0, 1200.0]) {
    testWidgets('dashboard stays ordered at width $width and enlarged text', (
      tester,
    ) async {
      tester.view.devicePixelRatio = 1;
      tester.view.physicalSize = Size(width, 950);
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      final data = dashboardData();
      String? destination;
      final boundary = GlobalKey();
      await tester.pumpWidget(
        MaterialApp(
          theme: ThemeData(
            useMaterial3: true,
            colorSchemeSeed: const Color(0xff24634f),
          ),
          home: MediaQuery(
            data: MediaQueryData(
              size: Size(width, 950),
              textScaler: TextScaler.linear(width == 320 ? 1.5 : 1),
            ),
            child: Scaffold(
              backgroundColor: const Color(0xfff5f8f2),
              appBar: AppBar(title: const Text('Dashboard')),
              body: RepaintBoundary(
                key: boundary,
                child: DashboardPage(
                  data: data,
                  onNavigate: (value) => destination = value,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Bugungi savdo'), findsOneWidget);
      expect(find.text('Bugungi sof foyda'), findsOneWidget);
      expect(find.text('Tezkor bo‘limlar'), findsNothing);
      await tester.tap(find.text('Savdo (POS)'));
      expect(destination, 'pos');
      final preview = Platform.environment['SAVDOZA_DASHBOARD_PREVIEW'];
      if (preview != null && width == 390) {
        final image =
            await (boundary.currentContext!.findRenderObject()
                    as RenderRepaintBoundary)
                .toImage();
        final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
        await tester.runAsync(
          () => File(preview).writeAsBytes(bytes!.buffer.asUint8List()),
        );
        image.dispose();
      }
      await tester.drag(find.byType(ListView).first, const Offset(0, -1800));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text('Kassirlar bo‘yicha savdo natijalari'), findsOneWidget);
      expect(find.text('Aziza Karimova'), findsOneWidget);
      await tester.pumpWidget(const SizedBox());
      data.api.client.close();
      data.dispose();
    });
  }
}
