import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'data.dart';
import 'desktop_table.dart';
import 'widgets.dart';

class CrudConfig {
  const CrudConfig(
    this.title,
    this.path,
    this.fields, {
    this.readOnly = false,
    this.canDelete = true,
    this.canEdit = true,
  });
  final String title, path;
  final List<Field> fields;
  final bool readOnly, canDelete, canEdit;
}

Map<String, String> references(List<Json> rows) => {
  for (final row in rows)
    '${row['id']}': '${row['name'] ?? row['fullName'] ?? row['id']}',
};
CrudConfig configFor(String section, AppData data) {
  final categories = references(records(data.cache['categories']));
  switch (section) {
    case 'products':
      return CrudConfig('Mahsulotlar', '/api/products', [
        const Field('name', 'Nomi', required: true),
        const Field('barcode', 'Shtrix-kod'),
        Field('categoryId', 'Kategoriya', options: categories),
        Field(
          'manufacturerId',
          'Ishlab chiqaruvchi',
          options: references(records(data.cache['manufacturers'])),
        ),
        const Field('salePrice', 'Sotuv narxi', required: true, number: true),
        const Field('minStock', 'Minimal qoldiq', number: true, integer: true),
        const Field('unit', 'Birligi'),
        const Field('description', 'Izoh', lines: 3),
      ]);
    case 'categories':
      return const CrudConfig('Kategoriyalar', '/api/categories', [
        Field('name', 'Nomi', required: true),
        Field('description', 'Izoh', lines: 3),
      ]);
    case 'customers':
      return const CrudConfig('Mijozlar', '/api/customers', [
        Field('name', 'Ism', required: true),
        Field('phone', 'Telefon'),
        Field('address', 'Manzil'),
        Field('notes', 'Izoh', lines: 3),
      ]);
    case 'suppliers':
      return const CrudConfig('Yetkazib beruvchilar', '/api/suppliers', [
        Field('name', 'Nomi', required: true),
        Field('phone', 'Telefon'),
        Field('address', 'Manzil'),
        Field('contactPerson', 'Mas’ul shaxs'),
        Field('debt', 'Qarz', number: true),
        Field('notes', 'Izoh'),
      ]);
    case 'staff':
      return const CrudConfig('Xodimlar', '/api/staff', [
        Field('fullName', 'Ism', required: true),
        Field('username', 'Login', required: true),
        Field('password', 'Parol', secret: true),
        Field('phone', 'Telefon'),
        Field(
          'role',
          'Vazifa',
          required: true,
          options: {
            'CASHIER': 'Kassir',
            'WAREHOUSEMAN': 'Omborchi',
            'SHOP_ADMIN': 'Do‘kon administratori',
          },
        ),
      ]);
    case 'debts':
      return const CrudConfig('Qarzlar', '/api/debts', [
        Field('firstName', 'Ism', required: true),
        Field('lastName', 'Familiya', required: true),
        Field('phone', 'Telefon'),
        Field('amount', 'Qarz summasi', required: true, number: true),
        Field('description', 'Izoh'),
        Field(
          'status',
          'Holat',
          options: {
            'OPEN': 'Ochiq',
            'PAID': 'To‘langan',
            'CANCELLED': 'Bekor qilingan',
          },
        ),
      ]);
    case 'batches':
      return const CrudConfig(
        'Ombor va partiyalar',
        '/api/inventory/batches',
        [],
        readOnly: true,
        canDelete: false,
      );
    case 'audit':
      return const CrudConfig(
        'Amallar jurnali',
        '/api/audit-logs',
        [],
        readOnly: true,
        canDelete: false,
      );
    case 'notifications':
      return const CrudConfig(
        'Bildirishnomalar',
        '/api/notifications',
        [],
        readOnly: true,
        canDelete: true,
      );
    case 'manufacturers':
      return const CrudConfig(
        'Ishlab chiqaruvchilar',
        '/api/manufacturers',
        [Field('name', 'Nomi', required: true), Field('country', 'Mamlakat')],
        canDelete: false,
        canEdit: false,
      );
    case 'shops':
      return const CrudConfig('Do‘konlar', '/api/shops', [
        Field('name', 'Do‘kon nomi', required: true),
        Field('phone', 'Telefon', required: true),
        Field('address', 'Manzil', required: true),
        Field('adminName', 'Administrator ismi', required: true),
        Field('adminUsername', 'Administrator logini'),
        Field('adminPassword', 'Administrator paroli', secret: true),
      ]);
    default:
      throw StateError('Bo‘lim topilmadi');
  }
}

class ManagementPage extends StatefulWidget {
  const ManagementPage({super.key, required this.data, required this.section});
  final AppData data;
  final String section;
  @override
  State<ManagementPage> createState() => _ManagementPageState();
}

class _ManagementPageState extends State<ManagementPage> {
  List<Json> rows = [];
  String search = '', error = '';
  bool loading = true, busy = false;
  CrudConfig get config => configFor(widget.section, widget.data);
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    if (mounted) setState(() => loading = true);
    try {
      final result = await widget.data.get(
        config.path,
        cacheKey: widget.section,
      );
      if (mounted) {
        setState(() {
          rows = records(result);
          error = '';
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> edit([Json? row]) async {
    if (!widget.data.online) {
      await message(
        context,
        'Bu amal uchun internetga ulaning. Offline POS savdolari alohida saqlanadi.',
      );
      return;
    }
    final body = await editForm(
      context,
      row == null ? '${config.title} · Qo‘shish' : 'Tahrirlash',
      config.fields,
      values: row ?? {},
    );
    if (body == null) return;
    if (widget.section == 'staff' &&
        row == null &&
        '${body['password'] ?? ''}'.length < 5) {
      if (mounted) await message(context, 'Yangi xodim uchun parol kiriting');
      return;
    }
    await action(() async {
      await widget.data.api.call(
        '${config.path}${row == null ? '' : '/${row['id']}'}',
        method: row == null ? 'POST' : 'PATCH',
        body: body,
      );
      await widget.data.refresh();
      await load();
    });
  }

  Future<void> action(Future<void> Function() function) async {
    if (busy) return;
    setState(() => busy = true);
    try {
      await function();
    } catch (e) {
      if (mounted) await message(context, e);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> remove(Json row) async {
    final approved = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('O‘chirish'),
        content: const Text('Ushbu yozuvni o‘chirasizmi?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: const Text('Bekor qilish'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, true),
            child: const Text('O‘chirish'),
          ),
        ],
      ),
    );
    if (approved != true) return;
    await action(() async {
      await widget.data.api.call(
        widget.section == 'notifications'
            ? '${config.path}?id=${row['id']}'
            : '${config.path}/${row['id']}',
        method: 'DELETE',
      );
      await load();
    });
  }

  Future<void> productCode(Json row) async {
    await action(() async {
      final result = await widget.data.api.call(
        '/api/products/${row['id']}/qr',
        method: 'POST',
        body: {},
      );
      final product = object(result['product']);
      final value =
          '${result['qrCode'] ?? product['qrCode'] ?? product['barcode'] ?? row['qrCode'] ?? row['barcode'] ?? ''}';
      if (!mounted) return;
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('${row['name']}'),
          content: SizedBox(
            width: 240,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                QrImageView(data: value, size: 220),
                SelectableText(value),
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: const Text('Yopish'),
            ),
          ],
        ),
      );
      await load();
    });
  }

  Widget rowActions(Json row) => Wrap(
    spacing: 4,
    children: [
      if (!config.readOnly && config.canEdit)
        TextButton.icon(
          onPressed: busy ? null : () => edit(row),
          icon: const Icon(Icons.edit_outlined),
          label: const Text('Tahrirlash'),
        ),
      if (widget.section == 'products')
        TextButton.icon(
          onPressed: busy ? null : () => productCode(row),
          icon: const Icon(Icons.qr_code),
          label: const Text('QR kodi'),
        ),
      if (widget.section == 'debts' && row['status'] == 'OPEN')
        TextButton(
          onPressed: busy
              ? null
              : () => action(() async {
                  await widget.data.api.call(
                    '/api/debts/${row['id']}',
                    method: 'PATCH',
                    body: {'status': 'PAID'},
                  );
                  await load();
                }),
          child: const Text('To‘landi'),
        ),
      if (config.canDelete)
        TextButton.icon(
          onPressed: busy ? null : () => remove(row),
          icon: const Icon(Icons.delete_outline),
          label: const Text('O‘chirish'),
        ),
      if (widget.section == 'shops' && row['planCode'] == 'LEGACY')
        TextButton(
          onPressed: busy
              ? null
              : () => action(() async {
                  final body = await editForm(
                    context,
                    'Obunani faollashtirish',
                    const [
                      Field(
                        'durationDays',
                        'Kunlar',
                        number: true,
                        integer: true,
                        required: true,
                      ),
                      Field(
                        'planName',
                        'Tarif',
                        required: true,
                        options: {'PRO': 'Pro', 'MAX': 'Max'},
                      ),
                      Field('price', 'Summa', number: true),
                    ],
                  );
                  if (body != null) {
                    await widget.data.api.call(
                      '/api/shops/${row['id']}/activate',
                      method: 'POST',
                      body: body,
                    );
                    await load();
                  }
                }),
          child: const Text('Obuna berish'),
        ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final visible = rows
        .where(
          (row) => row.values.any(
            (value) => '$value'.toLowerCase().contains(search.toLowerCase()),
          ),
        )
        .toList();
    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: InputDecoration(
                    labelText: '${config.title} · Qidirish',
                    prefixIcon: const Icon(Icons.search),
                  ),
                  onChanged: (value) => setState(() => search = value),
                ),
              ),
              IconButton(
                onPressed: loading ? null : load,
                icon: const Icon(Icons.refresh),
              ),
              if (!config.readOnly)
                Platform.isWindows
                    ? Padding(
                        padding: const EdgeInsets.only(left: 12),
                        child: FilledButton.icon(
                          onPressed: busy ? null : edit,
                          icon: const Icon(Icons.add, size: 20),
                          label: const Text('Qo‘shish'),
                        ),
                      )
                    : IconButton(
                        onPressed: busy ? null : edit,
                        icon: const Icon(Icons.add_circle),
                      ),
            ],
          ),
        ),
        if (error.isNotEmpty)
          Padding(
            padding: const EdgeInsets.all(12),
            child: Text(error, style: const TextStyle(color: Colors.red)),
          ),
        if (loading || busy) const LinearProgressIndicator(),
        Expanded(
          child: Platform.isWindows
              ? DesktopRecordsTable(
                  key: ValueKey('${config.path}:$search'),
                  rows: visible,
                  section: widget.section,
                  title: config.title,
                  actions: rowActions,
                )
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  itemCount: visible.length,
                  itemBuilder: (context, index) {
                    final row = visible[index];
                    final title =
                        '${row['name'] ?? row['fullName'] ?? row['title'] ?? row['firstName'] ?? row['action'] ?? row['batchNumber'] ?? row['id']}';
                    final details = <String>[
                      if (row['salePrice'] is num) money(row['salePrice']),
                      if (row['amount'] is num) money(row['amount']),
                      if (row['totalStock'] != null)
                        'Qoldiq ${row['totalStock']}',
                      if (row['currentQuantity'] != null)
                        'Qoldiq ${row['currentQuantity']}',
                      if (row['phone'] != null) '${row['phone']}',
                      if (row['role'] != null) '${row['role']}',
                      if (row['status'] != null) '${row['status']}',
                      if (row['message'] != null) '${row['message']}',
                      if (row['details'] != null) '${row['details']}',
                      if (row['expiryDate'] != null)
                        'Yaroqlilik ${dateText(row['expiryDate'])}',
                      if (row['_count'] is Map &&
                          object(row['_count'])['products'] != null)
                        '${row['_count']['products']} ta mahsulot',
                    ];
                    return Card(
                      child: Padding(
                        padding: const EdgeInsets.all(12),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: const TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            for (final detail in details) Text(detail),
                            rowActions(row),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}

class ReceiptHistory extends StatefulWidget {
  const ReceiptHistory({super.key, required this.data});
  final AppData data;
  @override
  State<ReceiptHistory> createState() => _ReceiptHistoryState();
}

class _ReceiptHistoryState extends State<ReceiptHistory> {
  final search = TextEditingController();
  List<Json> rows = [];
  int page = 1, total = 0;
  String from = '', to = '', error = '';
  bool busy = false;
  String get query => Uri(
    queryParameters: {
      if (search.text.isNotEmpty) 'search': search.text,
      if (from.isNotEmpty) 'from': from,
      if (to.isNotEmpty) 'to': to,
    },
  ).query;
  @override
  void initState() {
    super.initState();
    load();
  }

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<void> load() async {
    setState(() {
      busy = true;
      error = '';
    });
    try {
      final result = object(
        await widget.data.get(
          '/api/receipts?$query&page=$page',
          cacheKey: 'receipts-$page-$query',
        ),
      );
      if (mounted) {
        setState(() {
          rows = records(result['sales']);
          total = (result['total'] as num?)?.toInt() ?? 0;
        });
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> open(Json sale) async {
    try {
      final receipt = object(
        await widget.data.get(
          '/api/sales/${sale['id']}',
          cacheKey: 'receipt-${sale['id']}',
        ),
      );
      receipt.addAll({
        'shopName': object(receipt['shop'])['name'],
        'cashierName': object(receipt['cashier'])['fullName'],
      });
      if (mounted) await showReceipt(context, widget.data, receipt);
    } catch (e) {
      if (mounted) await message(context, e);
    }
  }

  Future<void> dates() async {
    final range = await showDateRangePicker(
      context: context,
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (range == null) return;
    from = range.start.toIso8601String().substring(0, 10);
    to = range.end.toIso8601String().substring(0, 10);
    page = 1;
    await load();
  }

  Future<void> export() async {
    try {
      final bytes = await widget.data.api.bytes('/api/receipts/export?$query');
      if (Platform.isAndroid || Platform.isWindows) {
        await device.invokeMethod('saveFile', {
          'bytes': Uint8List.fromList(bytes),
          'mime': 'text/csv',
          'filename': 'savdoza-cheklar.csv',
        });
      }
    } catch (e) {
      if (mounted) await message(context, e);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Expanded(
              child: TextField(
                controller: search,
                decoration: const InputDecoration(labelText: 'Chek raqami'),
                onSubmitted: (_) {
                  page = 1;
                  load();
                },
              ),
            ),
            IconButton(
              onPressed: busy ? null : dates,
              icon: const Icon(Icons.date_range),
            ),
            IconButton(
              onPressed: busy ? null : load,
              icon: const Icon(Icons.search),
            ),
          ],
        ),
      ),
      if (from.isNotEmpty) Text('$from — $to'),
      if (widget.data.owner)
        FilledButton.tonalIcon(
          onPressed: widget.data.max && widget.data.online ? export : null,
          icon: const Icon(Icons.download),
          label: const Text('CSV hisobot · MAX'),
        ),
      if (error.isNotEmpty)
        Padding(
          padding: const EdgeInsets.all(12),
          child: Text(error, style: const TextStyle(color: Colors.red)),
        ),
      if (busy) const LinearProgressIndicator(),
      Expanded(
        child: ListView(
          children: [
            for (final order in widget.data.orders.reversed)
              if (order['status'] != 'synced')
                Card(
                  color: const Color(0xfffff3dc),
                  child: ListTile(
                    leading: const Icon(Icons.cloud_upload_outlined),
                    title: Text('${object(order['receipt'])['receiptNumber']}'),
                    subtitle: Text(
                      order['status'] == 'conflict'
                          ? '${order['error']}'
                          : 'Telefonda · Sinxronlash kutilmoqda',
                    ),
                    onTap: () => showReceipt(
                      context,
                      widget.data,
                      object(order['receipt']),
                      url: '$serverUrl/chek/offline/${order['key']}',
                      pending: true,
                    ),
                  ),
                ),
            for (final sale in rows)
              Card(
                child: ListTile(
                  title: Text('${sale['receiptNumber']}'),
                  subtitle: Text(
                    '${dateText(sale['createdAt'])} · ${sale['paymentMethod']}',
                  ),
                  trailing: Text(money(sale['payableAmount'] as num)),
                  onTap: () => open(sale),
                ),
              ),
            if (!busy && rows.isEmpty)
              const Padding(
                padding: EdgeInsets.all(24),
                child: Text('Cheklar topilmadi'),
              ),
          ],
        ),
      ),
      Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          IconButton(
            onPressed: busy || page <= 1
                ? null
                : () {
                    page--;
                    load();
                  },
            icon: const Icon(Icons.chevron_left),
          ),
          Text('$page / ${((total + 24) ~/ 25).clamp(1, 100000)}'),
          IconButton(
            onPressed: busy || page * 25 >= total
                ? null
                : () {
                    page++;
                    load();
                  },
            icon: const Icon(Icons.chevron_right),
          ),
        ],
      ),
    ],
  );
}
