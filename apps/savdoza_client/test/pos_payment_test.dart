import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:savdoza_client/data.dart';
import 'package:savdoza_client/pos_payment.dart';

class PaymentApi extends Api {
  bool paid = false;
  @override
  Future<Json> call(String path, {String method = 'GET', Json? body}) async => {
    'success': true,
    'data': {
      'id': 'payment-1',
      'amount': 10000,
      'receiptNumber': 'CI-1',
      'paymentUrl': 'https://tezcheck.uz/pay/plk_ci',
      'status': paid ? 'PAID' : 'PENDING',
      if (paid) 'receipt': {'id': 'sale-1'},
    },
  };
}

void main() {
  for (final alreadyPaid in [false, true]) {
    testWidgets(
      'QR payment waits for server confirmation, alreadyPaid=$alreadyPaid',
      (tester) async {
        final api = PaymentApi()..paid = alreadyPaid;
        final data = AppData(api: api, store: DeviceStore(desktop: false));
        Json? receipt;
        await tester.pumpWidget(
          MaterialApp(
            home: Scaffold(
              body: Builder(
                builder: (context) => TextButton(
                  onPressed: () async {
                    receipt = await showElectronicPayment(context, data, {
                      'id': 'payment-1',
                      'amount': 10000,
                      'receiptNumber': 'CI-1',
                      'paymentUrl': 'https://tezcheck.uz/pay/plk_ci',
                      'status': alreadyPaid ? 'PAID' : 'PENDING',
                    });
                  },
                  child: const Text('Open payment'),
                ),
              ),
            ),
          ),
        );
        await tester.tap(find.text('Open payment'));
        await tester.pumpAndSettle();
        if (!alreadyPaid) {
          expect(receipt, isNull);
          expect(find.byType(QrImageView), findsOneWidget);
          expect(find.text('Karta yoki ilova orqali to‘lash'), findsOneWidget);
          api.paid = true;
          await tester.pump(const Duration(seconds: 5));
          await tester.pumpAndSettle();
        }
        expect(receipt?['id'], 'sale-1');
        expect(find.byType(ElectronicPaymentDialog), findsNothing);
        expect(tester.takeException(), isNull);
        await tester.pumpWidget(const SizedBox.shrink());
        data.dispose();
      },
    );
  }
}
