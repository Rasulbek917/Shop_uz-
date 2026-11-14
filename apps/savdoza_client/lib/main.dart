import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'data.dart';
import 'management.dart';
import 'pos.dart';
import 'screens.dart';

void main() {
  WidgetsFlutterBinding.ensureInitialized();
  runApp(
    MaterialApp(
      title: 'Savdoza',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        colorSchemeSeed: const Color(0xff24634f),
        scaffoldBackgroundColor: const Color(0xfff5f8f2),
        inputDecorationTheme: InputDecorationTheme(
          border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 14,
            vertical: 14,
          ),
        ),
        cardTheme: CardThemeData(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(16),
            side: const BorderSide(color: Color(0xffdce6dd)),
          ),
        ),
        appBarTheme: const AppBarTheme(
          backgroundColor: Color(0xfff5f8f2),
          foregroundColor: Color(0xff142d25),
        ),
      ),
      home: const Savdoza(),
    ),
  );
}

class Destination {
  const Destination(this.key, this.title, this.icon, {this.max = false});
  final String key, title;
  final IconData icon;
  final bool max;
}

class Savdoza extends StatefulWidget {
  const Savdoza({super.key});
  @override
  State<Savdoza> createState() => _SavdozaState();
}

class _SavdozaState extends State<Savdoza> with WidgetsBindingObserver {
  final data = AppData();
  Timer? timer, localTimer;
  bool loading = true;
  String section = 'dashboard', error = '';
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    data.addListener(changed);
    restore();
    timer = Timer.periodic(const Duration(seconds: 30), (_) {
      if (data.session != null) data.refresh();
    });
    localTimer = Timer.periodic(const Duration(seconds: 4), (_) {
      if (data.session != null) data.reload();
    });
  }

  void changed() {
    if (mounted) setState(() {});
  }

  Future<void> restore() async {
    try {
      await data.restore();
    } catch (e) {
      error = '$e';
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && data.session != null) {
      data.reload().then((_) => data.refresh());
    }
  }

  @override
  void dispose() {
    timer?.cancel();
    localTimer?.cancel();
    data.removeListener(changed);
    data.api.client.close();
    data.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  List<Destination> get destinations {
    if (data.user['role'] == 'SUPER_ADMIN') {
      return const [
        Destination('shops', 'Do‘konlar', Icons.storefront),
        Destination('requests', 'Xabarlar va arizalar', Icons.inbox_outlined),
        Destination(
          'pricing',
          'Tarif narxlari',
          Icons.workspace_premium_outlined,
        ),
        Destination('audit', 'Tizim jurnali', Icons.history),
        Destination('settings', 'Sozlamalar', Icons.settings_outlined),
      ];
    }
    if (data.user['role'] == 'WAREHOUSEMAN') {
      return const [
        Destination('dashboard', 'Dashboard', Icons.dashboard_outlined),
        Destination('products', 'Mahsulotlar', Icons.inventory_2_outlined),
        Destination('categories', 'Kategoriyalar', Icons.category_outlined),
        Destination('batches', 'Ombor va partiyalar', Icons.warehouse_outlined),
        Destination('inflow', 'Kirim', Icons.add_box_outlined),
        Destination('settings', 'Sozlamalar', Icons.settings_outlined),
      ];
    }
    if (data.user['role'] == 'CASHIER') {
      return const [
        Destination('dashboard', 'Dashboard', Icons.dashboard_outlined),
        Destination('pos', 'POS terminal', Icons.point_of_sale),
        Destination('receipts', 'Cheklar', Icons.receipt_long),
        Destination('returns', 'Qaytarishlar', Icons.keyboard_return),
        Destination('customers', 'Mijozlar', Icons.people_outline),
        Destination('queue', 'Sinxronlash', Icons.sync),
        Destination('settings', 'Sozlamalar', Icons.settings_outlined),
      ];
    }
    return const [
      Destination('dashboard', 'Dashboard', Icons.dashboard_outlined),
      Destination('pos', 'POS terminal', Icons.point_of_sale),
      Destination('products', 'Mahsulotlar', Icons.inventory_2_outlined),
      Destination('categories', 'Kategoriyalar', Icons.category_outlined),
      Destination('batches', 'Ombor va partiyalar', Icons.warehouse_outlined),
      Destination('inflow', 'Tezkor kirim', Icons.add_box_outlined),
      Destination(
        'manufacturers',
        'Ishlab chiqaruvchilar',
        Icons.factory_outlined,
      ),
      Destination('receipts', 'Cheklar va sotuvlar', Icons.receipt_long),
      Destination('returns', 'Qaytarishlar', Icons.keyboard_return),
      Destination('customers', 'Mijozlar', Icons.people_outline),
      Destination('debts', 'Qarzlar', Icons.credit_card),
      Destination(
        'suppliers',
        'Yetkazib beruvchilar',
        Icons.local_shipping_outlined,
        max: true,
      ),
      Destination('staff', 'Xodimlar', Icons.badge_outlined, max: true),
      Destination('reports', 'Hisobotlar', Icons.bar_chart),
      Destination('audit', 'Amallar jurnali', Icons.history, max: true),
      Destination(
        'notifications',
        'Bildirishnomalar',
        Icons.notifications_outlined,
      ),
      Destination('queue', 'Sinxronlash', Icons.sync),
      Destination('settings', 'Sozlamalar', Icons.settings_outlined),
    ];
  }

  Widget body() {
    if (!data.access && section != 'queue') return PlansPage(data: data);
    switch (section) {
      case 'dashboard':
        return dashboard();
      case 'pos':
        return PosPage(data: data);
      case 'settings':
        return SettingsPage(data: data);
      case 'queue':
        return OutboxPage(data: data);
      case 'reports':
        return ReportsPage(data: data);
      case 'receipts':
        return ReceiptHistory(data: data);
      case 'inflow':
        return InflowPage(data: data);
      case 'returns':
        return ReturnsPage(data: data);
      case 'requests':
        return AdminRequests(data: data);
      case 'pricing':
        return AdminPricing(data: data);
      default:
        return ManagementPage(
          data: data,
          section: section,
          key: ValueKey(section),
        );
    }
  }

  Widget dashboard() {
    final report = object(data.cache['reports']);
    final today = object(report['today']);
    return RefreshIndicator(
      onRefresh: data.refresh,
      child: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          Text(
            'Salom, ${data.user['fullName']}',
            style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
          ),
          const SizedBox(height: 8),
          Text(
            '${data.user['shopName'] ?? ''} · ${data.online ? 'Online' : 'Offline'}',
          ),
          const SizedBox(height: 20),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              stat(
                'Bugungi savdo',
                money((today['revenue'] as num?) ?? 0),
                Icons.trending_up,
              ),
              stat(
                'Savdolar',
                '${today['salesCount'] ?? 0} ta',
                Icons.receipt_long,
              ),
              stat(
                'Mahsulotlar',
                '${data.products.length} ta',
                Icons.inventory_2_outlined,
              ),
              stat('Sinxronlash', '${data.pending.length} ta', Icons.sync),
            ],
          ),
          const SizedBox(height: 16),
          if (data.sell)
            FilledButton.icon(
              onPressed: () => setState(() => section = 'pos'),
              icon: const Icon(Icons.point_of_sale),
              label: const Text('POS terminalni ochish'),
            ),
          if (data.pending.isNotEmpty)
            Card(
              color: const Color(0xfffff3dc),
              child: ListTile(
                title: Text(
                  '${data.pending.length} ta savdo telefonda saqlangan',
                ),
                subtitle: const Text('Internet qaytganda avtomatik yuboriladi'),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => setState(() => section = 'queue'),
              ),
            ),
          const SizedBox(height: 20),
          const Text(
            'Tezkor bo‘limlar',
            style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
          ),
          for (final destination in destinations.where(
            (item) => [
              'products',
              'categories',
              'receipts',
              'inflow',
              'reports',
            ].contains(item.key),
          ))
            Card(
              child: ListTile(
                leading: Icon(destination.icon),
                title: Text(destination.title),
                trailing: const Icon(Icons.chevron_right),
                onTap: () => setState(() => section = destination.key),
              ),
            ),
        ],
      ),
    );
  }

  Widget stat(String title, String value, IconData icon) => SizedBox(
    width: 230,
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: const Color(0xff24634f)),
            const SizedBox(height: 10),
            Text(
              value,
              style: const TextStyle(fontSize: 23, fontWeight: FontWeight.bold),
            ),
            Text(title),
          ],
        ),
      ),
    ),
  );
  Future<void> logout() async {
    if (data.pending.isNotEmpty) {
      final confirmed = await showDialog<bool>(
        context: context,
        builder: (ctx) => AlertDialog(
          title: const Text('Sinxronlanmagan savdolar bor'),
          content: const Text(
            'Savdolar telefonda qoladi. Ushbu hisobga qayta kirgach yuborish davom etadi. Hisobdan chiqasizmi?',
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx, false),
              child: const Text('Qolish'),
            ),
            FilledButton(
              onPressed: () => Navigator.pop(ctx, true),
              child: const Text('Chiqish'),
            ),
          ],
        ),
      );
      if (confirmed != true) return;
    }
    await data.logout();
    if (mounted) setState(() => section = 'dashboard');
  }

  @override
  Widget build(BuildContext context) {
    if (loading) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }
    if (error.isNotEmpty && data.session == null) {
      return Scaffold(
        body: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(error),
              FilledButton(
                onPressed: restore,
                child: const Text('Qayta urinish'),
              ),
            ],
          ),
        ),
      );
    }
    if (data.session == null || !data.cookieValid) {
      return AuthPage(
        data: data,
        onSignedIn: () {
          setState(
            () => section = data.user['role'] == 'SUPER_ADMIN'
                ? 'shops'
                : 'dashboard',
          );
        },
      );
    }
    if (!destinations.any((destination) => destination.key == section)) {
      section = destinations.first.key;
    }
    final selected = destinations.firstWhere((item) => item.key == section);
    return Scaffold(
      appBar: AppBar(
        title: Text(data.access ? selected.title : 'Tarifni yangilang'),
        actions: [
          IconButton(
            onPressed: data.refreshing ? null : data.refresh,
            icon: const Icon(Icons.refresh),
          ),
          PopupMenuButton<String>(
            onSelected: (action) {
              if (action == 'logout') {
                logout();
              } else {
                setState(() => section = 'settings');
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'profile',
                child: Text(
                  '${data.user['username']} · ${data.user['planCode']}',
                ),
              ),
              const PopupMenuItem(
                value: 'logout',
                child: Text('Hisobdan chiqish'),
              ),
            ],
          ),
        ],
      ),
      drawer: Drawer(
        child: SafeArea(
          child: Column(
            children: [
              ListTile(
                leading: const Icon(Icons.storefront, size: 38),
                title: const Text(
                  'SAVDOZA',
                  style: TextStyle(fontWeight: FontWeight.bold, fontSize: 24),
                ),
                subtitle: Text(
                  '${data.user['shopName'] ?? data.user['fullName']}',
                ),
              ),
              const Divider(),
              Expanded(
                child: ListView(
                  children: [
                    for (final destination in destinations)
                      ListTile(
                        selected: section == destination.key,
                        enabled:
                            (!destination.max || data.max) &&
                            (data.access ||
                                [
                                  'settings',
                                  'queue',
                                ].contains(destination.key)),
                        leading: Icon(destination.icon),
                        title: Text(destination.title),
                        subtitle: destination.max && !data.max
                            ? const Text('Max tarifiga o‘ting')
                            : null,
                        trailing: destination.max && !data.max
                            ? const Icon(Icons.lock_outline, size: 18)
                            : null,
                        onTap: () {
                          Navigator.pop(context);
                          setState(() => section = destination.key);
                        },
                      ),
                  ],
                ),
              ),
              ListTile(
                leading: Icon(
                  data.online ? Icons.cloud_done_outlined : Icons.cloud_off,
                ),
                title: Text(
                  data.online ? 'Online' : 'Offline · Telefonda saqlanadi',
                ),
                subtitle: Text(
                  '${data.pending.length} ta savdo yuborish kutilmoqda',
                ),
              ),
            ],
          ),
        ),
      ),
      body: Column(
        children: [
          if (data.refreshing) const LinearProgressIndicator(),
          if (!data.online || data.pending.isNotEmpty)
            Material(
              color: data.online
                  ? const Color(0xffe7f3e8)
                  : const Color(0xfffff3dc),
              child: ListTile(
                dense: true,
                leading: Icon(data.online ? Icons.sync : Icons.wifi_off),
                title: Text(
                  data.online
                      ? '${data.pending.length} ta savdo sinxronlanmoqda'
                      : 'Offline · Ma’lumotlar telefonda',
                ),
                subtitle: data.connectionError == null
                    ? null
                    : Text(data.connectionError!),
                onTap: () => setState(() => section = 'queue'),
              ),
            ),
          Expanded(
            child: KeyedSubtree(key: ValueKey(section), child: body()),
          ),
        ],
      ),
      bottomNavigationBar: data.access && data.user['role'] != 'SUPER_ADMIN'
          ? NavigationBar(
              selectedIndex: section == 'pos'
                  ? 1
                  : section == 'settings'
                  ? 2
                  : 0,
              onDestinationSelected: (index) => setState(
                () => section = index == 1
                    ? 'pos'
                    : index == 2
                    ? 'settings'
                    : 'dashboard',
              ),
              destinations: [
                const NavigationDestination(
                  icon: Icon(Icons.dashboard_outlined),
                  label: 'Dashboard',
                ),
                NavigationDestination(
                  icon: const Icon(Icons.point_of_sale),
                  label: 'POS',
                  enabled: data.sell,
                ),
                const NavigationDestination(
                  icon: Icon(Icons.settings_outlined),
                  label: 'Sozlamalar',
                ),
              ],
            )
          : null,
    );
  }
}

class AuthPage extends StatefulWidget {
  const AuthPage({super.key, required this.data, required this.onSignedIn});
  final AppData data;
  final VoidCallback onSignedIn;
  @override
  State<AuthPage> createState() => _AuthPageState();
}

class _AuthPageState extends State<AuthPage> {
  final form = GlobalKey<FormState>();
  final fields = {
    for (final key in [
      'username',
      'password',
      'fullName',
      'shopName',
      'phone',
      'email',
    ])
      key: TextEditingController(),
  };
  bool register = false, consent = false, busy = false;
  String plan = 'PRO', error = '';
  @override
  void dispose() {
    for (final controller in fields.values) {
      controller.dispose();
    }
    super.dispose();
  }

  Future<void> submit() async {
    if (busy || !form.currentState!.validate()) return;
    if (register && !consent) {
      setState(() => error = 'Foydalanish shartlarini qabul qiling');
      return;
    }
    setState(() {
      busy = true;
      error = '';
    });
    try {
      if (register) {
        await widget.data.registered({
          for (final entry in fields.entries)
            entry.key: entry.key == 'password'
                ? entry.value.text
                : entry.value.text.trim(),
          'planCode': plan,
          'consent': true,
        });
      } else {
        await widget.data.login(
          fields['username']!.text,
          fields['password']!.text,
        );
      }
      widget.onSignedIn();
    } catch (e) {
      if (mounted) setState(() => error = '$e');
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Widget input(String key, String label, {bool secret = false}) => Padding(
    padding: const EdgeInsets.only(bottom: 16),
    child: TextFormField(
      controller: fields[key],
      obscureText: secret,
      keyboardType: key == 'email'
          ? TextInputType.emailAddress
          : key == 'phone'
          ? TextInputType.phone
          : TextInputType.text,
      autofillHints: key == 'username'
          ? const [AutofillHints.username]
          : key == 'password'
          ? const [AutofillHints.password]
          : null,
      decoration: InputDecoration(labelText: label),
      validator: (value) => (value ?? '').trim().isEmpty ? 'To‘ldiring' : null,
    ),
  );
  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: SizedBox(
            width: 460,
            child: AutofillGroup(
              child: Form(
                key: form,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Icon(
                      Icons.storefront,
                      size: 64,
                      color: Color(0xff24634f),
                    ),
                    const Text(
                      'Savdoza',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 38,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      register
                          ? 'Do‘kon hisobini yarating'
                          : 'Hisobingizga kiring',
                      textAlign: TextAlign.center,
                      style: const TextStyle(fontSize: 20),
                    ),
                    const SizedBox(height: 28),
                    if (register) ...[
                      input('fullName', 'Ism va familiya'),
                      input('shopName', 'Do‘kon nomi'),
                      input('phone', 'Telefon +998…'),
                      input('email', 'Email'),
                    ],
                    input('username', 'Login (lotin harflari)'),
                    input(
                      'password',
                      register ? 'Parol (kamida 10 belgi)' : 'Parol',
                      secret: true,
                    ),
                    if (register) ...[
                      DropdownButtonFormField<String>(
                        initialValue: plan,
                        decoration: const InputDecoration(labelText: 'Tarif'),
                        items: const [
                          DropdownMenuItem(value: 'PRO', child: Text('Pro')),
                          DropdownMenuItem(value: 'MAX', child: Text('Max')),
                        ],
                        onChanged: (value) => setState(() => plan = value!),
                      ),
                      CheckboxListTile(
                        value: consent,
                        onChanged: (value) =>
                            setState(() => consent = value ?? false),
                        title: const Text(
                          'Foydalanish shartlarini qabul qilaman',
                        ),
                      ),
                      TextButton(
                        onPressed: () => launchUrl(
                          Uri.parse('$serverUrl/terms'),
                          mode: LaunchMode.externalApplication,
                        ),
                        child: const Text('Shartlarni o‘qish'),
                      ),
                    ],
                    if (error.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 12),
                        child: Text(
                          error,
                          style: const TextStyle(color: Colors.red),
                        ),
                      ),
                    FilledButton(
                      onPressed: busy ? null : submit,
                      child: Text(
                        busy
                            ? 'Kutilmoqda…'
                            : register
                            ? 'Hisob yaratish'
                            : 'Kirish',
                      ),
                    ),
                    TextButton(
                      onPressed: busy
                          ? null
                          : () => setState(() {
                              register = !register;
                              error = '';
                            }),
                      child: Text(
                        register ? 'Hisobim bor · Kirish' : 'Ro‘yxatdan o‘tish',
                      ),
                    ),
                    const Text(
                      'Birinchi kirish uchun internet kerak. Kirgandan keyin katalog va POS offline ishlaydi.',
                      textAlign: TextAlign.center,
                      style: TextStyle(fontSize: 12, color: Colors.grey),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    ),
  );
}
