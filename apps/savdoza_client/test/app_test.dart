import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:savdoza_client/data.dart';
import 'package:savdoza_client/main.dart';

class TestApi extends Api {
  @override
  Future<Json> call(String path, {String method = 'GET', Json? body}) async => {
    'success': true,
  };
}

AppData sample() {
  final data = AppData(api: TestApi());
  final exp =
      DateTime.now().add(const Duration(days: 2)).millisecondsSinceEpoch ~/
      1000;
  final token = base64Url
      .encode(utf8.encode(jsonEncode({'exp': exp})))
      .replaceAll('=', '');
  data.api.cookie = 'savdoza_auth_token=header.$token.signature';
  data.session = {
    'scope': 'test-owner',
    'cookie': data.api.cookie,
    'server': serverUrl,
    'account': {
      'user': {
        'id': 'owner',
        'shopId': 'shop',
        'role': 'SHOP_ADMIN',
        'planCode': 'PRO',
        'hasAccess': true,
        'subscriptionEndDate': DateTime.now()
            .add(const Duration(days: 5))
            .toIso8601String(),
      },
    },
  };
  data.cache = {
    'productsFetchedAt': DateTime.now().toUtc().toIso8601String(),
    'products': [
      {
        'id': 'product',
        'name': 'Sut',
        'salePrice': 10000,
        'batches': [
          {
            'id': 'batch',
            'currentQuantity': 5,
            'expiryDate': DateTime.now()
                .add(const Duration(days: 10))
                .toIso8601String(),
          },
        ],
      },
    ],
  };
  return data;
}

void main() {
  test('native totals match server rounding and tax rules', () {
    final items = [
      {'unitPrice': 1000, 'quantity': 3},
    ];
    expect(SaleTotals(items, .3, 0, false).total, 3000);
    expect(SaleTotals(items, 100, 12, false).total, 3248);
    final included = SaleTotals(items, 100, 12, true);
    expect(included.total, 2900);
    expect(included.tax, 311);
  });

  test('offline keys are random capability references', () {
    final keys = List.generate(100, (_) => saleKey());
    expect(keys.toSet().length, 100);
    expect(
      keys.every((key) => RegExp(r'^MOB-[a-f0-9]{64}$').hasMatch(key)),
      isTrue,
    );
  });
  test('offline sale is saved before stock is reserved and keeps the same retry key', () async {
    final data = sample();
    await data.persist();
    final created = DateTime.now().toUtc().toIso8601String();
    await data.enqueue(
      {
        'paymentMethod': 'CASH',
        'paidAmount': 20000,
        'discountAmount': 0,
        'expectedTotal': 20000,
        'items': [
          {
            'productId': 'product',
            'batchId': 'batch',
            'quantity': 2,
            'unitPrice': 10000,
            'discount': 0,
          },
        ],
      },
      {'createdAt': created, 'payableAmount': 20000, 'items': []},
    );
    expect(data.pending.length, 1);
    expect(data.products.first['totalStock'], 3);
    expect(
      records(data.cache['products']).first['batches'][0]['currentQuantity'],
      5,
    );
    final order = data.orders.single;
    expect(order['payload']['idempotencyKey'], order['key']);
    expect(order['payload']['occurredAt'], created);
    await data.store.mutate('enqueue', {'order': order});
    await data.reload();
    expect(data.orders.length, 1);
    expect(data.orders.single['key'], order['key']);
    await data.logout();
    expect(data.orders, isEmpty);
    expect(records((await data.store.read())['outbox']).length, 1);
    data.api.client.close();
    data.dispose();
  });
  test('expired or unpaid cached accounts cannot sell offline', () async {
    final data = sample();
    data.session!['account']['user']['hasAccess'] = false;
    expect(data.access, isFalse);
    await expectLater(
      data.enqueue(
        {'items': []},
        {'createdAt': DateTime.now().toUtc().toIso8601String()},
      ),
      throwsA(isA<ApiError>()),
    );
    data.session!['account']['user']['hasAccess'] = true;
    data.session!['account']['user']['subscriptionEndDate'] = DateTime.now()
        .subtract(const Duration(days: 1))
        .toIso8601String();
    expect(data.access, isFalse);
    data.api.client.close();
    data.dispose();
  });
  test(
    'reservations stay until a fresh catalogue confirms an acknowledged sale',
    () {
      final data = sample();
      final now = DateTime.now().toUtc();
      data.cache['productsFetchedAt'] = now
          .subtract(const Duration(minutes: 1))
          .toIso8601String();
      data.outbox = [
        {
          'scope': data.scope,
          'status': 'synced',
          'syncedAt': now.toIso8601String(),
          'payload': {
            'items': [
              {'productId': 'product', 'batchId': 'batch', 'quantity': 2},
            ],
          },
        },
      ];
      expect(data.products.first['totalStock'], 3);
      data.cache['productsFetchedAt'] = now
          .add(const Duration(seconds: 1))
          .toIso8601String();
      data.cache['products'][0]['batches'][0]['currentQuantity'] = 3;
      expect(data.products.first['totalStock'], 3);
      data.outbox.first['scope'] = 'different-owner';
      data.cache['products'][0]['batches'][0]['currentQuantity'] = 5;
      expect(data.products.first['totalStock'], 5);
      data.api.client.close();
      data.dispose();
    },
  );
  testWidgets('native app opens login and registration', (tester) async {
    await tester.pumpWidget(const MaterialApp(home: Savdoza()));
    await tester.pumpAndSettle();
    expect(find.text('Hisobingizga kiring'), findsOneWidget);
    await tester.tap(find.text('Ro‘yxatdan o‘tish'));
    await tester.pumpAndSettle();
    expect(find.text('Do‘kon hisobini yarating'), findsOneWidget);
    expect(find.text('Email'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
