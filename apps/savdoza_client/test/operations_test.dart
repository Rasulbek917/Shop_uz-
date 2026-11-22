import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:savdoza_client/data.dart';
import 'package:savdoza_client/operations.dart';

class OperationsApi extends Api {
  @override
  Future<Json> call(String path, {String method = 'GET', Json? body}) async {
    if (path == '/api/shifts')
      return {
        'success': true,
        'data': [
          {
            'id': 'shift',
            'status': 'OPEN',
            'mine': true,
            'openedAt': '2026-11-22T08:00:00Z',
            'cashier': {'fullName': 'Kassir'},
            'summary': {
              'salesCount': 2,
              'amounts': {'CASH': 120000, 'CARD': 20000},
              'expectedCash': 150000,
              'cashIn': 10000,
              'cashOut': 0,
            },
            'cashMovements': <Json>[],
          },
        ],
      };
    if (path == '/api/finance/summary')
      return {
        'success': true,
        'data': {
          'today': {
            'methods': [
              {'method': 'MIXED', 'amount': 140000, 'count': 2},
            ],
            'refunds': 0,
            'cashRefunds': 0,
          },
          'month': {'methods': <Json>[], 'refunds': 0, 'cashRefunds': 0},
          'receivables': {'amount': 0, 'count': 0},
          'supplierDebt': 0,
          'recentSales': <Json>[],
        },
      };
    throw StateError('Unexpected request: $path');
  }
}

void main() {
  testWidgets('shift page displays API cash summary', (tester) async {
    final data = AppData(
      api: OperationsApi(),
      store: DeviceStore(desktop: false),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: ShiftPage(data: data)),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Smena ochiq'), findsOneWidget);
    expect(find.textContaining('150 000'), findsOneWidget);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    data.api.client.close();
    data.dispose();
  });

  testWidgets('finance page includes mixed payments', (tester) async {
    final data = AppData(
      api: OperationsApi(),
      store: DeviceStore(desktop: false),
    );
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(body: FinancePage(data: data)),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Aralash'), findsOneWidget);
    expect(find.text('140 000 so‘m'), findsWidgets);
    expect(tester.takeException(), isNull);
    await tester.pumpWidget(const SizedBox());
    data.api.client.close();
    data.dispose();
  });
}
