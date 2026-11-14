import 'dart:io';
import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'data.dart';
import 'password_field.dart';

Future<void> message(BuildContext context, Object error) async {
  if (context.mounted) {
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(content: Text('$error'), behavior: SnackBarBehavior.floating),
    );
  }
}

class Field {
  const Field(
    this.key,
    this.label, {
    this.required = false,
    this.number = false,
    this.integer = false,
    this.secret = false,
    this.options,
    this.lines = 1,
  });
  final String key, label;
  final bool required, number, integer, secret;
  final Map<String, String>? options;
  final int lines;
}

Future<Json?> editForm(
  BuildContext context,
  String title,
  List<Field> fields, {
  Json values = const {},
}) async {
  final controllers = {
    for (final field in fields)
      field.key: TextEditingController(text: '${values[field.key] ?? ''}'),
  };
  final key = GlobalKey<FormState>();
  final result = await showDialog<Json>(
    context: context,
    builder: (dialog) => AlertDialog(
      title: Text(title),
      content: SizedBox(
        width: 520,
        child: SingleChildScrollView(
          child: Form(
            key: key,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                for (final field in fields)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: field.options != null
                        ? DropdownButtonFormField<String>(
                            initialValue:
                                field.options!.containsKey(
                                  controllers[field.key]!.text,
                                )
                                ? controllers[field.key]!.text
                                : null,
                            isExpanded: true,
                            decoration: InputDecoration(labelText: field.label),
                            items: field.options!.entries
                                .map(
                                  (entry) => DropdownMenuItem(
                                    value: entry.key,
                                    child: Text(entry.value),
                                  ),
                                )
                                .toList(),
                            onChanged: (value) =>
                                controllers[field.key]!.text = value ?? '',
                            validator: (value) =>
                                field.required &&
                                    (value == null || value.isEmpty)
                                ? 'Tanlang'
                                : null,
                          )
                        : field.secret
                        ? PasswordField(
                            controller: controllers[field.key]!,
                            label: field.label,
                            validator: (value) =>
                                field.required && (value ?? '').isEmpty
                                ? 'To‘ldiring'
                                : null,
                          )
                        : TextFormField(
                            controller: controllers[field.key],
                            obscureText: field.secret,
                            maxLines: field.secret ? 1 : field.lines,
                            keyboardType: field.number
                                ? const TextInputType.numberWithOptions(
                                    decimal: true,
                                  )
                                : TextInputType.text,
                            decoration: InputDecoration(labelText: field.label),
                            validator: (value) {
                              if (field.required &&
                                  (value ?? '').trim().isEmpty) {
                                return 'To‘ldiring';
                              }
                              if (field.number &&
                                  (value ?? '').isNotEmpty &&
                                  (num.tryParse(value!.replaceAll(',', '.')) ==
                                          null ||
                                      (field.integer &&
                                          int.tryParse(value) == null))) {
                                return 'To‘g‘ri son kiriting';
                              }
                              return null;
                            },
                          ),
                  ),
              ],
            ),
          ),
        ),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(dialog),
          child: const Text('Bekor qilish'),
        ),
        FilledButton(
          onPressed: () {
            if (!key.currentState!.validate()) return;
            final body = <String, dynamic>{};
            for (final field in fields) {
              final text = field.secret
                  ? controllers[field.key]!.text
                  : controllers[field.key]!.text.trim();
              if (text.isEmpty && !field.required) continue;
              body[field.key] = field.number
                  ? num.parse(text.replaceAll(',', '.'))
                  : text;
            }
            Navigator.pop(dialog, body);
          },
          child: const Text('Saqlash'),
        ),
      ],
    ),
  );
  // Controllers stay alive until the dialog's closing transition has completed.
  await Future<void>.delayed(const Duration(milliseconds: 250));
  for (final controller in controllers.values) {
    controller.dispose();
  }
  return result;
}

class ScannerPage extends StatefulWidget {
  const ScannerPage({super.key});
  @override
  State<ScannerPage> createState() => _ScannerPageState();
}

class _ScannerPageState extends State<ScannerPage> {
  bool returned = false;
  final controller = Platform.isWindows ? null : MobileScannerController();
  @override
  void dispose() {
    controller?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(
      title: const Text('QR / Shtrix-kod'),
      actions: [
        if (controller != null)
          IconButton(
            onPressed: controller!.toggleTorch,
            icon: const Icon(Icons.flash_on),
          ),
      ],
    ),
    body: Platform.isWindows
        ? Padding(
            padding: const EdgeInsets.all(24),
            child: TextField(
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Shtrix-kod',
                hintText: 'USB skaner yoki klaviatura orqali kiriting',
              ),
              onSubmitted: (code) {
                if (code.trim().isNotEmpty) Navigator.pop(context, code.trim());
              },
            ),
          )
        : MobileScanner(
            controller: controller,
            onDetect: (capture) {
              final code = capture.barcodes.firstOrNull?.rawValue;
              if (returned || code == null || code.isEmpty) return;
              returned = true;
              Navigator.pop(context, code);
            },
          ),
  );
}

Future<void> showReceipt(
  BuildContext context,
  AppData data,
  Json receipt, {
  String? url,
  bool pending = false,
}) async {
  String? link = url ?? receipt['offlineUrl'] as String?;
  if (link == null) {
    try {
      final result = object(
        await data.get(
          '/api/receipts/link?receiptNumber=${Uri.encodeComponent('${receipt['receiptNumber']}')}',
        ),
      );
      link = result['url'] as String?;
    } catch (_) {
      /* Receipt remains visible if its public link is temporarily unavailable. */
    }
  }
  if (!context.mounted) return;
  await Navigator.push(
    context,
    MaterialPageRoute<void>(
      builder: (_) =>
          ReceiptScreen(receipt: receipt, link: link, pending: pending),
    ),
  );
}

class ReceiptScreen extends StatefulWidget {
  const ReceiptScreen({
    super.key,
    required this.receipt,
    required this.link,
    required this.pending,
  });
  final Json receipt;
  final String? link;
  final bool pending;
  @override
  State<ReceiptScreen> createState() => _ReceiptScreenState();
}

class _ReceiptScreenState extends State<ReceiptScreen> {
  final boundary = GlobalKey();
  bool busy = false;
  Future<void> output(bool print) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      final image =
          await (boundary.currentContext!.findRenderObject()!
                  as RenderRepaintBoundary)
              .toImage(pixelRatio: 2);
      final bytes = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      if (bytes == null) throw Exception('Chek rasmi olinmadi');
      if (!Platform.isAndroid && !Platform.isWindows) {
        throw Exception(
          'Chop etish va saqlash ushbu versiyada Android uchun ochilgan',
        );
      }
      await device.invokeMethod(print ? 'printPng' : 'saveFile', {
        'bytes': Uint8List.view(bytes.buffer),
        'filename': 'savdoza-chek.png',
        'mime': 'image/png',
      });
    } catch (error) {
      if (mounted) await message(context, error);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final receipt = widget.receipt;
    return Scaffold(
      appBar: AppBar(title: const Text('Savdo cheki')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Center(
          child: RepaintBoundary(
            key: boundary,
            child: Container(
              color: Colors.white,
              width: 390,
              padding: const EdgeInsets.all(24),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '${receipt['shopName'] ?? 'Savdoza'}',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (receipt['shopAddress'] != null)
                    Text(
                      '${receipt['shopAddress']}',
                      textAlign: TextAlign.center,
                    ),
                  const Divider(),
                  Text('Chek ${receipt['receiptNumber']}'),
                  Text(dateText(receipt['createdAt'])),
                  if (widget.pending)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 10),
                      child: Text(
                        'OFFLINE · Serverga yuborish kutilmoqda',
                        style: TextStyle(
                          color: Colors.orange,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  const Divider(),
                  for (final item in records(receipt['items']))
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            '${item['productName'] ?? object(item['product'])['name'] ?? 'Mahsulot'}',
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                          Text(
                            '${item['quantity']} × ${money((item['unitPrice'] as num?) ?? 0)}',
                          ),
                          Align(
                            alignment: Alignment.centerRight,
                            child: Text(
                              money((item['totalPrice'] as num?) ?? 0),
                            ),
                          ),
                        ],
                      ),
                    ),
                  const Divider(),
                  Text(
                    'Chegirma ${money((receipt['discountAmount'] as num?) ?? 0)}',
                  ),
                  Text('Soliq ${money((receipt['taxAmount'] as num?) ?? 0)}'),
                  Text(
                    'Jami ${money((receipt['payableAmount'] as num?) ?? 0)}',
                    style: const TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text(
                    'To‘langan ${money((receipt['paidAmount'] as num?) ?? 0)}',
                  ),
                  Text(
                    'Qaytim ${money((receipt['changeAmount'] as num?) ?? 0)}',
                  ),
                  if (widget.link != null)
                    Center(child: QrImageView(data: widget.link!, size: 190)),
                  const Text(
                    'Xaridingiz uchun rahmat!',
                    textAlign: TextAlign.center,
                  ),
                  const Text(
                    'Ichki savdo cheki',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 11),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Row(
                children: [
                  Expanded(
                    child: FilledButton.icon(
                      onPressed: busy ? null : () => output(true),
                      icon: const Icon(Icons.print),
                      label: const Text('Chek chiqarish'),
                    ),
                  ),
                  const SizedBox(width: 10),
                  IconButton(
                    onPressed: busy ? null : () => output(false),
                    tooltip: 'PNG saqlash',
                    icon: const Icon(Icons.download),
                  ),
                ],
              ),
              TextButton(
                onPressed: busy ? null : () => Navigator.pop(context),
                child: const Text('Yangi savdoni boshlash'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
