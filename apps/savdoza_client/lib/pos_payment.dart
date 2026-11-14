import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:qr_flutter/qr_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import 'data.dart';
import 'widgets.dart';

class PosGatewayPage extends StatefulWidget {
  const PosGatewayPage({super.key, required this.data});
  final AppData data;
  @override
  State<PosGatewayPage> createState() => _PosGatewayPageState();
}

class _PosGatewayPageState extends State<PosGatewayPage> {
  Json info = {};
  String error = '';
  bool busy = false;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = object(
        (await widget.data.api.call('/api/shop/pos-gateway'))['data'],
      );
      if (mounted) setState(() => info = result);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> connect() async {
    final form = await editForm(
      context,
      'Do‘kon Tezcheck kassasi',
      const [
        Field('cashDeskCode', 'Kassa kodi', required: true),
        Field('token', 'API tokeni', required: true, secret: true),
        Field(
          'webhookSecret',
          'Webhook maxfiy kaliti',
          required: true,
          secret: true,
        ),
      ],
      values: {'cashDeskCode': info['cashDeskCode'] ?? ''},
    );
    if (form == null || !mounted) return;
    setState(() {
      busy = true;
      error = '';
    });
    try {
      await widget.data.api.call(
        '/api/shop/pos-gateway',
        method: 'PUT',
        body: form,
      );
      await load();
      if (mounted)
        await message(
          context,
          'Kassa ulandi. Tezcheck kabinetiga quyidagi webhook manzilini kiriting.',
        );
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('POS elektron to‘lovlari')),
    body: ListView(
      padding: const EdgeInsets.all(24),
      children: [
        Text(
          info['configured'] == true ? 'Kassa ulangan' : 'Kassa ulanmagan',
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        const SizedBox(height: 12),
        const Text(
          'Do‘koningizning Tezcheck kassasini ulang. Xaridor to‘lovi shu kassaga tushadi.',
        ),
        const SizedBox(height: 20),
        FilledButton.icon(
          onPressed: busy ? null : connect,
          icon: const Icon(Icons.account_balance),
          label: Text(
            busy ? 'Tekshirilmoqda…' : 'Kassani ulash yoki yangilash',
          ),
        ),
        if ('${info['webhookUrl'] ?? ''}'.isNotEmpty) ...[
          const SizedBox(height: 24),
          const Text('Tezcheck kassasida webhook manzilini qo‘shing'),
          const SizedBox(height: 8),
          SelectableText('${info['webhookUrl']}'),
          TextButton.icon(
            onPressed: () async {
              await Clipboard.setData(
                ClipboardData(text: '${info['webhookUrl']}'),
              );
              if (context.mounted) await message(context, 'Manzil nusxalandi');
            },
            icon: const Icon(Icons.copy),
            label: const Text('Manzilni nusxalash'),
          ),
        ],
        const SizedBox(height: 16),
        const Text(
          'Kassada asosiy to‘lov havolasi va kerakli to‘lov usullarini yoqing. Karta ma’lumotlari to‘lov xizmatining sahifasida kiritiladi.',
        ),
        if (error.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 16),
            child: Text(error, style: const TextStyle(color: Colors.red)),
          ),
      ],
    ),
  );
}

Future<Json?> showElectronicPayment(
  BuildContext context,
  AppData data,
  Json order,
) => showDialog<Json>(
  context: context,
  barrierDismissible: false,
  builder: (_) => ElectronicPaymentDialog(data: data, order: order),
);

class ElectronicPaymentDialog extends StatefulWidget {
  const ElectronicPaymentDialog({
    super.key,
    required this.data,
    required this.order,
  });
  final AppData data;
  final Json order;
  @override
  State<ElectronicPaymentDialog> createState() =>
      _ElectronicPaymentDialogState();
}

class _ElectronicPaymentDialogState extends State<ElectronicPaymentDialog> {
  late Json order = widget.order;
  Timer? timer;
  bool busy = false;
  late String error = '${widget.order['warning'] ?? ''}';
  @override
  void initState() {
    super.initState();
    check();
    timer = Timer.periodic(const Duration(seconds: 5), (_) => check());
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> check({bool cancel = false}) async {
    if (busy || order['status'] != 'PENDING') return;
    setState(() => busy = true);
    try {
      final current = object(
        (await widget.data.api.call(
          '/api/pos/payments/${order['id']}',
          method: cancel ? 'DELETE' : 'GET',
        ))['data'],
      );
      if (!mounted) return;
      setState(() {
        order = current;
        error = '';
      });
      if (current['status'] == 'PAID' && current['receipt'] is Map) {
        Navigator.pop(context, object(current['receipt']));
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> open() async {
    final uri = Uri.tryParse('${order['paymentUrl']}');
    if (uri == null || uri.scheme != 'https' || uri.host != 'tezcheck.uz')
      return;
    try {
      if (!await launchUrl(uri, mode: LaunchMode.externalApplication) &&
          mounted)
        await message(
          context,
          'To‘lov sahifasi ochilmadi. QR koddan foydalaning.',
        );
    } catch (e) {
      if (mounted) await message(context, e);
    }
  }

  @override
  Widget build(BuildContext context) => AlertDialog(
    title: const Text('Elektron to‘lov'),
    content: SizedBox(
      width: 400,
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              money(order['amount'] as num? ?? 0),
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            Text('${order['receiptNumber']}'),
            if (order['status'] == 'CANCELLED')
              const Padding(
                padding: EdgeInsets.all(20),
                child: Text(
                  'To‘lov bekor qilindi. Mahsulotlar omborga qaytarildi.',
                ),
              )
            else ...[
              if (order['paymentUrl'] != null)
                QrImageView(
                  data: '${order['paymentUrl']}',
                  size: 240,
                  backgroundColor: Colors.white,
                ),
              const Text(
                'QR kodni telefon kamerasi bilan skanerlang yoki to‘lov sahifasini oching.',
              ),
              const SizedBox(height: 12),
              FilledButton.icon(
                onPressed: order['paymentUrl'] == null ? null : open,
                icon: const Icon(Icons.open_in_browser),
                label: const Text('Karta yoki ilova orqali to‘lash'),
              ),
              const SizedBox(height: 12),
              const Text(
                'To‘lov tasdig‘i kutilmoqda. Tasdiqlangach chek ochiladi.',
              ),
              Wrap(
                spacing: 8,
                children: [
                  TextButton(
                    onPressed: busy ? null : () => check(),
                    child: const Text('Natijani tekshirish'),
                  ),
                  TextButton(
                    onPressed: busy ? null : () => check(cancel: true),
                    child: const Text('To‘lovni bekor qilish'),
                  ),
                ],
              ),
            ],
            if (error.isNotEmpty)
              Text(error, style: const TextStyle(color: Colors.red)),
          ],
        ),
      ),
    ),
    actions: [
      TextButton(
        onPressed: () => Navigator.pop(context),
        child: Text(
          order['status'] == 'CANCELLED' ? 'Yopish' : 'Keyinroq davom ettirish',
        ),
      ),
    ],
  );
}

Future<void> pendingElectronicPayments(
  BuildContext context,
  AppData data,
) async {
  try {
    final rows = records((await data.api.call('/api/pos/payments'))['data']);
    if (!context.mounted) return;
    if (rows.isEmpty) {
      await message(context, 'Kutilayotgan elektron to‘lovlar yo‘q');
      return;
    }
    final selected = await showDialog<Json>(
      context: context,
      builder: (context) => SimpleDialog(
        title: const Text('Kutilayotgan to‘lovlar'),
        children: [
          for (final row in rows)
            SimpleDialogOption(
              onPressed: () => Navigator.pop(context, row),
              child: Text(
                '${row['receiptNumber']} · ${money(row['amount'] as num)}',
              ),
            ),
        ],
      ),
    );
    if (selected == null || !context.mounted) return;
    final receipt = await showElectronicPayment(context, data, selected);
    await data.refresh();
    if (receipt != null && context.mounted)
      await showReceipt(context, data, receipt);
  } catch (e) {
    if (context.mounted) await message(context, e);
  }
}
