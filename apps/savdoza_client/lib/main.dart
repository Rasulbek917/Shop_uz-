import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

void main() => runApp(
  MaterialApp(
    title: 'Savdoza',
    debugShowCheckedModeBanner: false,
    theme: ThemeData(
      useMaterial3: true,
      colorSchemeSeed: const Color(0xff24634f),
      scaffoldBackgroundColor: const Color(0xfff5f8f2),
    ),
    home: const Savdoza(),
  ),
);

String money(num value) =>
    '${value.round().toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (m) => '${m[1]} ')} so‘m';

class Api {
  final client = HttpClient()..connectionTimeout = const Duration(seconds: 15);
  String server = '';
  String? cookie;
  Future<Map<String, dynamic>> call(
    String path, [
    Map<String, dynamic>? body,
  ]) async {
    final request = await client.openUrl(
      body == null ? 'GET' : 'POST',
      Uri.parse('$server$path'),
    );
    if (cookie != null) request.headers.set('Cookie', cookie!);
    if (body != null) {
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode(body));
    }
    final response = await request.close().timeout(const Duration(seconds: 25));
    final text = await response.transform(utf8.decoder).join();
    Map<String, dynamic> data;
    try {
      data = jsonDecode(text) as Map<String, dynamic>;
    } catch (_) {
      throw Exception('Server javobi noto‘g‘ri. Domenni tekshiring.');
    }
    if (response.statusCode >= 400 || data['success'] == false) {
      final error = data['error'];
      throw Exception(
        error is Map ? error['message'] : error ?? 'So‘rov bajarilmadi',
      );
    }
    for (final c in response.cookies) {
      if (c.name == 'savdoza_auth_token') cookie = '${c.name}=${c.value}';
    }
    return data;
  }
}

class Line {
  Line(this.product, this.batch);
  final Map<String, dynamic> product, batch;
  int quantity = 1;
  num get price => product['salePrice'] as num;
  Map<String, dynamic> json() => {
    'productId': product['id'],
    'batchId': batch['id'],
    'quantity': quantity,
    'unitPrice': price,
    'discount': 0,
  };
}

class Savdoza extends StatefulWidget {
  const Savdoza({super.key});
  @override
  State<Savdoza> createState() => _SavdozaState();
}

class _SavdozaState extends State<Savdoza> {
  final api = Api();
  Timer? accountTimer;

  @override
  void initState() {
    super.initState();
    accountTimer = Timer.periodic(const Duration(minutes: 1), (_) {
      if (account != null && !busy) {
        operation(refresh);
      }
    });
  }

  final server = TextEditingController(
    text: const String.fromEnvironment('API_URL', defaultValue: 'https://'),
  );
  final login = TextEditingController(),
      password = TextEditingController(),
      search = TextEditingController();
  Map<String, dynamic>? account;
  List<dynamic> products = [], sales = [];
  final List<Line> cart = [];
  bool busy = false;
  int page = 0;
  String? error, saleKey;
  String payment = 'CASH';
  num taxRate = 0;
  bool taxIncluded = false;
  Map<String, dynamic> get user =>
      Map<String, dynamic>.from(account?['user'] ?? {});
  bool get access => user['hasAccess'] == true;
  bool get canSell => ['SHOP_ADMIN', 'CASHIER'].contains(user['role']);
  num get subtotal =>
      cart.fold<num>(0, (sum, line) => sum + line.quantity * line.price);
  num get total =>
      taxIncluded ? subtotal : subtotal + (subtotal * taxRate / 100).round();
  @override
  void dispose() {
    accountTimer?.cancel();
    for (final c in [server, login, password, search]) {
      c.dispose();
    }
    api.client.close();
    super.dispose();
  }

  Future<void> operation(Future<void> Function() action) async {
    if (busy) return;
    setState(() {
      busy = true;
      error = null;
    });
    try {
      await action();
    } catch (e) {
      if (mounted) {
        setState(() => error = e.toString().replaceFirst('Exception: ', ''));
      }
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> refresh() async {
    final result = await api.call('/api/account');
    if (!mounted) return;
    setState(() => account = Map<String, dynamic>.from(result['data']));
    if (access && user['role'] != 'SUPER_ADMIN') {
      final catalog = await api.call('/api/products');
      final history = await api.call('/api/sales');
      final settings = await api.call('/api/shop/settings');
      if (mounted) {
        setState(() {
          products = catalog['data'];
          sales = history['data'];
          taxRate = settings['data']['taxRate'] ?? 0;
          taxIncluded = settings['data']['taxIncluded'] == true;
        });
      }
    }
  }

  Future<void> signIn() => operation(() async {
    final uri = Uri.tryParse(server.text.trim());
    if (uri == null ||
        uri.scheme != 'https' ||
        uri.host.isEmpty ||
        uri.userInfo.isNotEmpty ||
        uri.hasQuery ||
        uri.hasFragment ||
        (uri.path.isNotEmpty && uri.path != '/')) {
      throw Exception('HTTPS server domenini kiriting');
    }
    api.server = server.text.trim().replaceAll(RegExp(r'/+$'), '');
    await api.call('/api/auth/login', {
      'username': login.text.trim(),
      'password': password.text,
    });
    await refresh();
    password.clear();
  });
  void add(Map<String, dynamic> p) {
    if (busy) return;
    final batches = (p['batches'] as List)
        .where(
          (b) =>
              b['currentQuantity'] > 0 &&
              DateTime.parse(b['expiryDate']).isAfter(DateTime.now()),
        )
        .toList();
    batches.sort(
      (a, b) =>
          a['expiryDate'].toString().compareTo(b['expiryDate'].toString()),
    );
    for (final batch in batches) {
      final line = cart.where((l) => l.batch['id'] == batch['id']).firstOrNull;
      if (line == null) {
        setState(() => cart.add(Line(p, Map<String, dynamic>.from(batch))));
        saleKey = null;
        return;
      }
      if (line.quantity < batch['currentQuantity']) {
        setState(() => line.quantity++);
        saleKey = null;
        return;
      }
    }
    setState(() => error = 'Yaroqli qoldiq yetarli emas');
  }

  Future<String?> ask(String title, String label, {String initial = ''}) async {
    final controller = TextEditingController(text: initial);
    final result = await showDialog<String>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text(title),
        content: TextField(
          controller: controller,
          decoration: InputDecoration(labelText: label),
          maxLength: 500,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Bekor qilish'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(ctx, controller.text),
            child: const Text('Tasdiqlash'),
          ),
        ],
      ),
    );
    // Dialog animations finish after its route returns.
    Future.delayed(const Duration(seconds: 1), controller.dispose);
    return result;
  }

  Future<void> checkout() async {
    if (busy || cart.isEmpty) return;
    final text = await ask(
      'Jami ${money(total)}',
      'Qabul qilingan summa',
      initial: total.round().toString(),
    );
    if (text == null || !mounted) return;
    await operation(() async {
      final paid = num.tryParse(text);
      if (paid == null || !paid.isFinite || paid < total) {
        throw Exception('To‘lov summasi yetarli emas');
      }
      saleKey ??= 'APP_${DateTime.now().microsecondsSinceEpoch}_${user['id']}';
      final result = await api.call('/api/sales', {
        'paymentMethod': payment,
        'paidAmount': paid,
        'discountAmount': 0,
        'idempotencyKey': saleKey,
        'items': cart.map((l) => l.json()).toList(),
      });
      if (!mounted) return;
      setState(() {
        cart.clear();
        saleKey = null;
      });
      final receipt = result['data'];
      await showDialog<void>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: Text('Chek ${receipt['receiptNumber']}'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                for (final item in receipt['items'])
                  Text(
                    '${item['productName']} × ${item['quantity']} — ${money(item['totalPrice'])}',
                  ),
                const Divider(),
                Text('Jami ${money(receipt['payableAmount'])}'),
                Text('Qaytim ${money(receipt['changeAmount'])}'),
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
      await refresh();
    });
  }

  Widget loginView() => Center(
    child: SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: SizedBox(
        width: 420,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(Icons.storefront, size: 64, color: Color(0xff24634f)),
            const Text(
              'Savdoza',
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 38, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 28),
            field(server, 'Server manzili — https://domen.uz'),
            field(login, 'Login'),
            field(password, 'Parol', secret: true),
            FilledButton(
              onPressed: busy ? null : signIn,
              child: const Text('Kirish'),
            ),
            const SizedBox(height: 16),
            const Text(
              'Android va Windows uchun do‘kon boshqaruvi. Mavjud hisobingiz va HTTPS server manzilidan foydalaning.',
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    ),
  );
  Widget field(
    TextEditingController controller,
    String label, {
    bool secret = false,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextField(
      controller: controller,
      obscureText: secret,
      decoration: InputDecoration(
        labelText: label,
        border: const OutlineInputBorder(),
      ),
    ),
  );
  Widget dashboard() => ListView(
    padding: const EdgeInsets.all(24),
    children: [
      Text(
        'Salom, ${user['fullName']}',
        style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
      ),
      const SizedBox(height: 20),
      Wrap(
        spacing: 16,
        runSpacing: 16,
        children: [
          stat('Mahsulotlar', '${products.length}', Icons.inventory_2_outlined),
          stat('Yuklangan savdolar', '${sales.length}', Icons.receipt_long),
        ],
      ),
      const SizedBox(height: 20),
      if (canSell)
        FilledButton.icon(
          onPressed: () => setState(() => page = 1),
          icon: const Icon(Icons.point_of_sale),
          label: const Text('POS terminal'),
        ),
      const SizedBox(height: 24),
      const Text('So‘nggi savdolar', style: TextStyle(fontSize: 22)),
      for (final s in sales.take(15))
        ListTile(
          title: Text(s['receiptNumber']),
          subtitle: Text(s['paymentMethod']),
          trailing: Text(money(s['payableAmount'])),
        ),
    ],
  );
  Widget stat(String title, String value, IconData icon) => SizedBox(
    width: 240,
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon),
            Text(
              value,
              style: const TextStyle(fontSize: 32, fontWeight: FontWeight.bold),
            ),
            Text(title),
          ],
        ),
      ),
    ),
  );
  Widget pos() {
    final term = search.text.toLowerCase();
    final shown = products
        .where(
          (p) =>
              p['name'].toString().toLowerCase().contains(term) ||
              (p['barcode'] ?? '').toString().contains(term),
        )
        .toList();
    final catalog = Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            controller: search,
            onChanged: (_) => setState(() {}),
            onSubmitted: (code) {
              final match = products.where((p) => p['barcode'] == code.trim());
              if (match.isNotEmpty) {
                add(Map<String, dynamic>.from(match.first));
                search.clear();
                setState(() {});
              }
            },
            decoration: const InputDecoration(
              labelText: 'Mahsulot yoki shtrix-kod',
              prefixIcon: Icon(Icons.search),
              border: OutlineInputBorder(),
            ),
          ),
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 230,
              mainAxisExtent: 130,
              crossAxisSpacing: 8,
              mainAxisSpacing: 8,
            ),
            itemCount: shown.length,
            itemBuilder: (_, i) {
              final p = shown[i];
              return Card(
                child: InkWell(
                  onTap: busy ? null : () => add(Map<String, dynamic>.from(p)),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          p['name'],
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const Spacer(),
                        Text(money(p['salePrice'])),
                        Text('Qoldiq ${p['totalStock']}'),
                      ],
                    ),
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
    final basket = Column(
      children: [
        const ListTile(
          title: Text(
            'Savat',
            style: TextStyle(fontSize: 23, fontWeight: FontWeight.bold),
          ),
        ),
        Expanded(
          child: ListView(
            children: [
              for (final l in cart)
                ListTile(
                  title: Text(l.product['name']),
                  subtitle: Text(money(l.price * l.quantity)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        onPressed: busy
                            ? null
                            : () => setState(() {
                                l.quantity--;
                                if (l.quantity == 0) cart.remove(l);
                                saleKey = null;
                              }),
                        icon: const Icon(Icons.remove_circle_outline),
                      ),
                      Text('${l.quantity}'),
                      IconButton(
                        onPressed: busy ? null : () => add(l.product),
                        icon: const Icon(Icons.add_circle_outline),
                      ),
                    ],
                  ),
                ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Jami ${money(total)}',
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.bold,
                ),
              ),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'CASH', label: Text('Naqd')),
                  ButtonSegment(value: 'CARD', label: Text('Karta')),
                ],
                selected: {payment},
                onSelectionChanged: busy
                    ? null
                    : (v) => setState(() => payment = v.first),
              ),
              const SizedBox(height: 8),
              FilledButton(
                onPressed: busy || cart.isEmpty ? null : checkout,
                child: const Text('To‘lovni qabul qilish'),
              ),
            ],
          ),
        ),
      ],
    );
    return LayoutBuilder(
      builder: (_, size) => size.maxWidth > 850
          ? Row(
              children: [
                Expanded(child: catalog),
                SizedBox(width: 365, child: basket),
              ],
            )
          : Column(
              children: [
                Expanded(child: catalog),
                SizedBox(height: 300, child: basket),
              ],
            ),
    );
  }

  Widget accountView() {
    final shop = account?['shop'];
    return ListView(
      padding: const EdgeInsets.all(24),
      children: [
        const Text(
          'Hisob va tarif',
          style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
        ),
        const SizedBox(height: 16),
        Text(
          access
              ? 'Hisob faol'
              : 'Tarifni yangilang yoki superadmin tasdig‘ini kuting.',
        ),
        if (shop != null) ...[
          Text('Do‘kon ${shop['name']}'),
          Text('Tarif ${shop['planCode']}'),
          Text('Tugash sanasi ${shop['subscriptionEndDate'] ?? '—'}'),
        ],
        for (final p in account?['plans'] ?? [])
          Card(
            child: Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    p['name'],
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  Text('${money(p['price'])} / 30 kun'),
                  Text(p['paymentInstructions'].toString()),
                  FilledButton(
                    onPressed:
                        !busy &&
                            p['enabled'] == true &&
                            user['role'] == 'SHOP_ADMIN'
                        ? () async {
                            final ref = await ask(
                              'To‘lov so‘rovi',
                              'Tranzaksiya raqami va to‘lov izohi',
                            );
                            if (ref == null || !mounted) return;
                            await operation(() async {
                              if (ref.trim().length < 5) {
                                throw Exception(
                                  'To‘lov izohini to‘liq kiriting',
                                );
                              }
                              await api.call('/api/purchases', {
                                'planCode': p['code'],
                                'reference': ref.trim(),
                              });
                              await refresh();
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text(
                                      'So‘rov yuborildi. Tasdiqni kuting.',
                                    ),
                                  ),
                                );
                              }
                            });
                          }
                        : null,
                    child: const Text('To‘lovni tekshirishga yuborish'),
                  ),
                ],
              ),
            ),
          ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final authenticated = account != null;
    final selected = access && user['role'] != 'SUPER_ADMIN' ? page : 2;
    return Scaffold(
      appBar: authenticated
          ? AppBar(
              title: Text(user['shopName'] ?? 'Savdoza'),
              actions: [
                Center(child: Text(user['planCode'] ?? '')),
                IconButton(
                  onPressed: busy ? null : () => operation(refresh),
                  icon: const Icon(Icons.refresh),
                ),
                IconButton(
                  onPressed: busy
                      ? null
                      : () => operation(() async {
                          try {
                            await api.call('/api/auth/logout', {});
                          } finally {
                            api.cookie = null;
                            if (mounted) {
                              setState(() {
                                account = null;
                                cart.clear();
                                products = [];
                                sales = [];
                                page = 0;
                              });
                            }
                          }
                        }),
                  icon: const Icon(Icons.logout),
                ),
              ],
            )
          : null,
      body: Column(
        children: [
          if (busy) const LinearProgressIndicator(),
          if (error != null)
            Padding(
              padding: const EdgeInsets.all(12),
              child: Text(error!, style: const TextStyle(color: Colors.red)),
            ),
          Expanded(
            child: !authenticated
                ? loginView()
                : selected == 2
                ? accountView()
                : selected == 1 && canSell
                ? pos()
                : dashboard(),
          ),
        ],
      ),
      bottomNavigationBar: authenticated
          ? NavigationBar(
              selectedIndex: selected,
              onDestinationSelected: busy
                  ? null
                  : (i) => setState(() => page = i),
              destinations: [
                NavigationDestination(
                  icon: const Icon(Icons.dashboard_outlined),
                  label: 'Dashboard',
                  enabled: access && user['role'] != 'SUPER_ADMIN',
                ),
                NavigationDestination(
                  icon: const Icon(Icons.point_of_sale),
                  label: 'POS',
                  enabled: access && canSell,
                ),
                const NavigationDestination(
                  icon: Icon(Icons.workspace_premium_outlined),
                  label: 'Tarif',
                ),
              ],
            )
          : null,
    );
  }
}
