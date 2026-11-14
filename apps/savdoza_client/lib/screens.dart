import 'dart:async';
import 'dart:io';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'data.dart';
import 'updates.dart';
import 'widgets.dart';
import 'management.dart';

class PlansPage extends StatefulWidget {
  const PlansPage({super.key, required this.data});
  final AppData data;
  @override
  State<PlansPage> createState() => _PlansPageState();
}

class _PlansPageState extends State<PlansPage> {
  List<Json> methods = [];
  String? selected, error;
  bool busy = false;
  Timer? timer;
  @override
  void initState() {
    super.initState();
    load();
    timer = Timer.periodic(const Duration(seconds: 10), (_) => reconcile());
  }

  @override
  void dispose() {
    timer?.cancel();
    super.dispose();
  }

  Future<void> load() async {
    try {
      final result = object(await widget.data.get('/api/checkout/methods'));
      if (mounted) setState(() => methods = records(result['methods']));
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> reconcile() async {
    if (busy) return;
    try {
      for (final order in records(
        object(widget.data.account['shop'])['checkoutOrders'],
      ).where((order) => order['status'] == 'PENDING')) {
        await widget.data.get('/api/checkout/${order['id']}');
      }
      await widget.data.refresh();
      if (mounted) setState(() {});
    } catch (_) {
      /* Payment stays pending until the server verifies it. */
    }
  }

  Future<void> purchase(Json plan) async {
    if (selected == null) {
      await message(context, 'To‘lov usulini tanlang');
      return;
    }
    setState(() {
      busy = true;
      error = null;
    });
    try {
      final result = object(
        (await widget.data.api.call(
          '/api/checkout',
          method: 'POST',
          body: {
            'planCode': plan['code'],
            'providerCode': selected,
            'username': widget.data.user['username'],
          },
        ))['data'],
      );
      await widget.data.refresh();
      final uri = Uri.parse('${result['paymentUrl']}');
      if (uri.scheme != 'https' ||
          !await launchUrl(uri, mode: LaunchMode.externalApplication)) {
        throw Exception('To‘lov sahifasini ochib bo‘lmadi');
      }
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      Text(
        'Hisob ${widget.data.user['username']}',
        style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
      ),
      Text(
        'Tarif ${widget.data.user['planCode']} · ${widget.data.access ? 'Faol' : 'To‘lov yoki yangilash kerak'}',
      ),
      Text(
        'Amal qilish muddati ${dateText(widget.data.user['subscriptionEndDate'])}',
      ),
      if (error != null)
        Padding(
          padding: const EdgeInsets.symmetric(vertical: 12),
          child: Text(error!, style: const TextStyle(color: Colors.red)),
        ),
      DropdownButtonFormField<String>(
        decoration: const InputDecoration(labelText: 'To‘lov usuli'),
        items: methods
            .map(
              (method) => DropdownMenuItem(
                value: '${method['provider_code']}',
                child: Text('${method['name']}'),
              ),
            )
            .toList(),
        onChanged: busy ? null : (value) => setState(() => selected = value),
      ),
      for (final plan in records(
        widget.data.account['plans'],
      ).where((plan) => ['PRO', 'MAX'].contains(plan['code'])))
        Card(
          child: Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  '${plan['name']}',
                  style: const TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                Text(
                  '${money(plan['price'] as num)} / 30 kun',
                  style: const TextStyle(fontSize: 20),
                ),
                const SizedBox(height: 10),
                const Text(
                  'POS, mahsulotlar, kategoriyalar, ombor, mijozlar, nasiya, cheklar va hisobotlar',
                ),
                if (plan['code'] == 'MAX')
                  const Text(
                    'Xodimlar, yetkazib beruvchilar, markaziy import, amallar jurnali, CSV va to‘lov tahlili',
                  ),
                const SizedBox(height: 12),
                FilledButton(
                  onPressed:
                      busy || plan['enabled'] != true || !widget.data.online
                      ? null
                      : () => purchase(plan),
                  child: const Text('To‘lovga o‘tish'),
                ),
              ],
            ),
          ),
        ),
      OutlinedButton.icon(
        onPressed: busy ? null : reconcile,
        icon: const Icon(Icons.refresh),
        label: const Text('To‘lovni tekshirish'),
      ),
      const Text(
        'To‘lov Tezcheck sahifasida yakunlanadi. Tasdiqlanganidan keyin tarif avtomatik ochiladi.',
      ),
      for (final order in records(
        object(widget.data.account['shop'])['checkoutOrders'],
      ))
        ListTile(
          title: Text(
            '${order['planCode']} · ${money(order['amount'] as num)}',
          ),
          subtitle: Text('${dateText(order['createdAt'])}\n${order['status']}'),
        ),
    ],
  );
}

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key, required this.data});
  final AppData data;
  Future<void> update(BuildContext context, bool password) async {
    final current = object((await data.api.call('/api/profile'))['data']);
    if (!context.mounted) return;
    final body = await editForm(
      context,
      password ? 'Parolni almashtirish' : 'Profil',
      password
          ? const [
              Field(
                'currentPassword',
                'Hozirgi parol',
                required: true,
                secret: true,
              ),
              Field(
                'newPassword',
                'Yangi parol (10+ belgi)',
                required: true,
                secret: true,
              ),
              Field(
                'confirmPassword',
                'Yangi parolni takrorlang',
                required: true,
                secret: true,
              ),
            ]
          : const [
              Field('fullName', 'Ism', required: true),
              Field('username', 'Login', required: true),
              Field('phone', 'Telefon'),
            ],
      values: password ? {} : current,
    );
    if (body == null) return;
    try {
      await data.api.call(
        password ? '/api/auth/change-password' : '/api/profile',
        method: password ? 'POST' : 'PATCH',
        body: body,
      );
      await data.persist();
      await data.refresh();
      if (context.mounted) await message(context, 'Saqlandi');
    } catch (e) {
      if (context.mounted) await message(context, e);
    }
  }

  Future<void> shop(BuildContext context) async {
    final body = await editForm(context, 'Do‘kon sozlamalari', const [
      Field('address', 'Manzil'),
      Field('phone', 'Telefon'),
      Field('taxRate', 'Soliq foizi', number: true),
    ], values: object(data.cache['shopSettings']));
    if (body == null) return;
    try {
      await data.api.call('/api/shop/settings', method: 'PATCH', body: body);
      await data.refresh();
    } catch (e) {
      if (context.mounted) await message(context, e);
    }
  }

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      Text(
        '${data.user['fullName']}',
        style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
      ),
      Text('${data.user['username']} · ${data.user['role']}'),
      if (Platform.isAndroid)
        ListenableBuilder(
          listenable: appUpdates,
          builder: (context, _) => ListTile(
            leading: const Icon(Icons.system_update),
            title: const Text('Ilovani yangilash'),
            subtitle: Text(
              appUpdates.available
                  ? 'Yangi versiya ${appUpdates.release!.version}'
                  : 'Versiyani tekshirish',
            ),
            trailing: const Icon(Icons.chevron_right),
            onTap: () => openUpdates(context),
          ),
        ),
      Card(
        child: Column(
          children: [
            ListTile(
              leading: const Icon(Icons.person_outline),
              title: const Text('Profilni tahrirlash'),
              enabled: data.online,
              onTap: () => update(context, false),
            ),
            ListTile(
              leading: const Icon(Icons.lock_outline),
              title: const Text('Parolni almashtirish'),
              enabled: data.online,
              onTap: () => update(context, true),
            ),
          ],
        ),
      ),
      if (data.owner) ...[
        ListTile(
          leading: const Icon(Icons.storefront),
          title: const Text('Do‘kon sozlamalari'),
          enabled: data.online,
          onTap: () => shop(context),
        ),
        ListTile(
          leading: const Icon(Icons.workspace_premium),
          title: const Text('Tarif va obuna'),
          onTap: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => Scaffold(
                appBar: AppBar(title: const Text('Tarif va obuna')),
                body: PlansPage(data: data),
              ),
            ),
          ),
        ),
      ],
      ListTile(
        leading: const Icon(Icons.sync),
        title: Text('Sinxronlash · ${data.pending.length} ta kutilmoqda'),
        onTap: () => Navigator.push(
          context,
          MaterialPageRoute<void>(
            builder: (_) => Scaffold(
              appBar: AppBar(title: const Text('Sinxronlash')),
              body: OutboxPage(data: data),
            ),
          ),
        ),
      ),
      Text('Katalog yangilangan ${dateText(data.cache['productsFetchedAt'])}'),
      const Padding(
        padding: EdgeInsets.all(16),
        child: Text(
          'Offline katalog va savdolar telefonda shifrlangan holda saqlanadi. Ro‘yxatdan o‘tish, tarif, sozlamalar va boshqaruvdagi o‘zgarishlar uchun internet kerak.',
        ),
      ),
    ],
  );
}

class OutboxPage extends StatelessWidget {
  const OutboxPage({super.key, required this.data});
  final AppData data;
  @override
  Widget build(BuildContext context) => AnimatedBuilder(
    animation: data,
    builder: (context, _) => ListView(
      padding: const EdgeInsets.all(16),
      children: [
        FilledButton.icon(
          onPressed: () async {
            await data.store.sync(force: true);
            await data.reload();
          },
          icon: const Icon(Icons.sync),
          label: const Text('Hozir sinxronlash'),
        ),
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 12),
          child: Text(
            'Internet qaytganda Android savdolarni avtomatik yuboradi. Xato chiqqan savdo telefonda saqlanib qoladi.',
          ),
        ),
        for (final order in data.orders.reversed)
          Card(
            child: ListTile(
              title: Text(
                order['status'] == 'synced'
                    ? 'Serverga saqlangan'
                    : order['status'] == 'conflict'
                    ? 'Tekshirish kerak'
                    : 'Yuborish kutilmoqda',
              ),
              subtitle: SelectableText(
                '${dateText(order['createdAt'])}\n${order['key']}\n${order['error'] ?? ''}',
              ),
              onTap: () => showReceipt(
                context,
                data,
                object(order['receipt']),
                url: '$serverUrl/chek/offline/${order['key']}',
                pending: order['status'] != 'synced',
              ),
              trailing: order['status'] == 'conflict'
                  ? IconButton(
                      icon: const Icon(Icons.refresh),
                      onPressed: () async {
                        await data.store.mutate('retry', {'key': order['key']});
                        await data.store.sync(force: true);
                        await data.reload();
                      },
                    )
                  : Icon(
                      order['status'] == 'synced'
                          ? Icons.cloud_done
                          : Icons.cloud_upload_outlined,
                    ),
            ),
          ),
      ],
    ),
  );
}

class ReportsPage extends StatelessWidget {
  const ReportsPage({super.key, required this.data});
  final AppData data;
  @override
  Widget build(BuildContext context) {
    final reports = object(data.cache['reports']);
    return ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text(
          'Savdo hisoboti',
          style: TextStyle(fontSize: 26, fontWeight: FontWeight.bold),
        ),
        for (final period in ['today', 'month'])
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    period == 'today' ? 'Bugun' : 'Shu oy',
                    style: const TextStyle(fontSize: 22),
                  ),
                  Text(
                    'Tushum ${money((object(reports[period])['revenue'] as num?) ?? 0)}',
                  ),
                  Text(
                    'Savdolar ${object(reports[period])['salesCount'] ?? 0} ta',
                  ),
                  Text(
                    'Foyda ${money((object(reports[period])['profit'] as num?) ?? 0)}',
                  ),
                  Text(
                    'Qaytarish ${money((object(reports[period])['refundTotal'] as num?) ?? 0)}',
                  ),
                ],
              ),
            ),
          ),
        const Text('Ko‘p sotilgan mahsulotlar', style: TextStyle(fontSize: 20)),
        for (final product in records(reports['topProducts']))
          ListTile(
            title: Text('${product['name'] ?? product['productName']}'),
            subtitle: Text(
              'Sotildi ${product['quantity'] ?? product['totalQuantity']}',
            ),
            trailing: Text(money((product['totalRevenue'] as num?) ?? 0)),
          ),
        const Text('Ombor holati', style: TextStyle(fontSize: 20)),
        for (final row in records(
          object(reports['inventory'])['lowStockProducts'],
        ))
          ListTile(
            title: Text('${row['name']}'),
            subtitle: Text(
              'Qoldiq ${row['totalStock'] ?? row['currentStock']}',
            ),
          ),
        if (data.owner && data.max)
          FutureBuilder<dynamic>(
            future: data.get(
              '/api/receipts/analytics',
              cacheKey: 'receiptAnalytics',
            ),
            builder: (context, snapshot) => Column(
              children: [
                const Text('To‘lov turlari bo‘yicha · Max'),
                for (final group in records(snapshot.data))
                  ListTile(
                    title: Text('${group['paymentMethod']}'),
                    subtitle: Text('${group['count']} ta savdo'),
                    trailing: Text(money(group['amount'] as num)),
                  ),
              ],
            ),
          ),
      ],
    );
  }
}

class InflowPage extends StatelessWidget {
  const InflowPage({super.key, required this.data});
  final AppData data;
  Future<void> create(BuildContext context) async {
    final body = await editForm(context, 'Omborga kirim', [
      Field(
        'productId',
        'Mahsulot',
        required: true,
        options: references(data.products),
      ),
      const Field('batchNumber', 'Partiya raqami', required: true),
      const Field(
        'quantity',
        'Miqdor',
        number: true,
        integer: true,
        required: true,
      ),
      const Field('purchasePrice', 'Xarid narxi', number: true, required: true),
      const Field('salePrice', 'Sotuv narxi', number: true, required: true),
      const Field(
        'expiryDate',
        'Yaroqlilik sanasi (YYYY-MM-DD)',
        required: true,
      ),
    ]);
    if (body == null) return;
    try {
      await data.api.call('/api/inventory/inflow', method: 'POST', body: body);
      await data.refresh();
      if (context.mounted) await message(context, 'Kirim saqlandi');
    } catch (e) {
      if (context.mounted) await message(context, e);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.all(20),
        child: FilledButton.icon(
          onPressed: data.online ? () => create(context) : null,
          icon: const Icon(Icons.add),
          label: const Text('Yangi kirim'),
        ),
      ),
      Expanded(
        child: ManagementPage(data: data, section: 'batches'),
      ),
    ],
  );
}

class ReturnsPage extends StatefulWidget {
  const ReturnsPage({super.key, required this.data});
  final AppData data;
  @override
  State<ReturnsPage> createState() => _ReturnsPageState();
}

class _ReturnsPageState extends State<ReturnsPage> {
  List<Json> rows = [];
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = records(
        await widget.data.get('/api/returns', cacheKey: 'returns'),
      );
      if (mounted) setState(() => rows = result);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> create() async {
    try {
      final form = await editForm(context, 'Asl chekni topish', const [
        Field('receiptNumber', 'Chek raqami', required: true),
      ]);
      if (form == null) return;
      final list = object(
        await widget.data.get(
          '/api/receipts?search=${Uri.encodeComponent('${form['receiptNumber']}')}',
        ),
      );
      final candidates = records(list['sales'])
          .where((row) => row['receiptNumber'] == form['receiptNumber'])
          .toList();
      if (candidates.isEmpty) {
        throw Exception('Asl chek topilmadi. To‘liq raqamni kiriting.');
      }
      final sale = object(
        await widget.data.get('/api/sales/${candidates.first['id']}'),
      );
      final items = records(sale['items']);
      if (!mounted) return;
      final quantities = await editForm(context, 'Qaytariladigan miqdorlar', [
        for (final item in items)
          Field(
            '${item['id']}',
            '${object(item['product'])['name']} (max ${item['quantity']})',
            number: true,
            integer: true,
          ),
        const Field('reason', 'Sababi'),
      ]);
      if (quantities == null) return;
      final selected = <Json>[];
      for (final item in items) {
        final amount = (quantities['${item['id']}'] as num?) ?? 0;
        if (amount <= 0) continue;
        if (amount > (item['quantity'] as num)) {
          throw Exception('Qaytarish miqdori sotilgan miqdordan katta');
        }
        selected.add({
          'saleItemId': item['id'],
          'productId': item['productId'],
          'batchId': item['batchId'],
          'quantity': amount,
          'refundUnitPrice': item['unitPrice'],
        });
      }
      if (selected.isEmpty) {
        throw Exception('Kamida bitta mahsulot miqdorini kiriting');
      }
      await widget.data.api.call(
        '/api/returns',
        method: 'POST',
        body: {
          'saleId': sale['id'],
          'reason': quantities['reason'],
          'items': selected,
        },
      );
      await load();
      await widget.data.refresh();
    } catch (e) {
      if (mounted) await message(context, e);
    }
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.all(16),
        child: FilledButton.icon(
          onPressed: widget.data.online ? create : null,
          icon: const Icon(Icons.keyboard_return),
          label: const Text('Tovar qaytarish'),
        ),
      ),
      if (error != null) Text(error!),
      Expanded(
        child: ListView(
          children: [
            for (final row in rows)
              Card(
                child: ListTile(
                  title: Text('${object(row['sale'])['receiptNumber']}'),
                  subtitle: Text(
                    '${dateText(row['createdAt'])} · ${row['reason'] ?? ''}',
                  ),
                  trailing: Text(
                    money((row['totalRefundAmount'] as num?) ?? 0),
                  ),
                ),
              ),
          ],
        ),
      ),
    ],
  );
}

class AdminRequests extends StatefulWidget {
  const AdminRequests({super.key, required this.data});
  final AppData data;
  @override
  State<AdminRequests> createState() => _AdminRequestsState();
}

class _AdminRequestsState extends State<AdminRequests> {
  Json rows = {};
  String? error;
  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    try {
      final result = object(await widget.data.get('/api/platform/requests'));
      if (mounted) setState(() => rows = result);
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    }
  }

  Future<void> review(Json row, String kind, bool approve) async {
    try {
      await widget.data.api.call(
        '/api/platform/requests',
        method: 'PATCH',
        body: {
          'id': row['id'],
          'kind': kind,
          'approve': approve,
          'note': approve
              ? 'Android panelida tasdiqlandi'
              : 'Android panelida rad etildi',
        },
      );
      await load();
    } catch (e) {
      if (mounted) await message(context, e);
    }
  }

  @override
  Widget build(BuildContext context) => ListView(
    padding: const EdgeInsets.all(20),
    children: [
      if (error != null) Text(error!),
      for (final kind in ['registrations', 'purchases']) ...[
        Text(
          kind == 'registrations' ? 'Arizalar' : 'To‘lov so‘rovlari',
          style: const TextStyle(fontSize: 24),
        ),
        for (final row in records(rows[kind]))
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${row['name'] ?? object(row['shop'])['name']}'),
                  Text('${row['reference'] ?? row['phone'] ?? ''}'),
                  Row(
                    children: [
                      TextButton(
                        onPressed: () => review(
                          row,
                          kind == 'registrations' ? 'registration' : 'purchase',
                          false,
                        ),
                        child: const Text('Rad etish'),
                      ),
                      FilledButton(
                        onPressed: () => review(
                          row,
                          kind == 'registrations' ? 'registration' : 'purchase',
                          true,
                        ),
                        child: const Text('Tasdiqlash'),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
      ],
    ],
  );
}

class AdminPricing extends StatelessWidget {
  const AdminPricing({super.key, required this.data});
  final AppData data;
  @override
  Widget build(BuildContext context) => FutureBuilder<dynamic>(
    future: data.get('/api/plans'),
    builder: (context, snapshot) => ListView(
      padding: const EdgeInsets.all(20),
      children: [
        if (snapshot.hasError) Text('${snapshot.error}'),
        for (final plan in records(
          snapshot.data,
        ).where((plan) => ['PRO', 'MAX'].contains(plan['code'])))
          Card(
            child: ListTile(
              title: Text('${plan['name']}'),
              subtitle: Text(
                '${money(plan['price'] as num)} · ${plan['enabled'] == true ? 'Ochiq' : 'Yopiq'}',
              ),
              trailing: const Icon(Icons.edit),
              onTap: () async {
                final body = await editForm(
                  context,
                  '${plan['code']} narxi',
                  const [
                    Field(
                      'price',
                      'Narxi',
                      number: true,
                      integer: true,
                      required: true,
                    ),
                    Field(
                      'enabled',
                      'Xarid holati',
                      required: true,
                      options: {'true': 'Ochiq', 'false': 'Yopiq'},
                    ),
                    Field(
                      'paymentInstructions',
                      'To‘lov yo‘riqnomasi',
                      lines: 3,
                    ),
                  ],
                  values: {...plan, 'enabled': '${plan['enabled']}'},
                );
                if (body == null) return;
                try {
                  await data.api.call(
                    '/api/plans',
                    method: 'PUT',
                    body: {
                      ...body,
                      'code': plan['code'],
                      'enabled': body['enabled'] == 'true',
                      'paymentInstructions': body['paymentInstructions'] ?? '',
                    },
                  );
                  await data.refresh();
                  if (context.mounted) {
                    await message(
                      context,
                      'Tarif narxi saqlandi. Sahifani qayta ochib tekshiring.',
                    );
                  }
                } catch (e) {
                  if (context.mounted) await message(context, e);
                }
              },
            ),
          ),
      ],
    ),
  );
}
