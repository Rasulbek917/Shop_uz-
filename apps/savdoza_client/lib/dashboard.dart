import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'data.dart';

double _amount(dynamic value) => (value as num?)?.toDouble() ?? 0;

const _ink = Color(0xff142d25);
const _green = Color(0xff24634f);
const _muted = Color(0xff64748b);

class DashboardPage extends StatelessWidget {
  const DashboardPage({
    super.key,
    required this.data,
    required this.onNavigate,
  });

  final AppData data;
  final ValueChanged<String> onNavigate;

  @override
  Widget build(BuildContext context) {
    final report = object(data.cache['reports']);
    final today = object(report['today']);
    final inventory = object(report['inventory']);
    final warehouse = data.user['role'] == 'WAREHOUSEMAN';
    final metrics = <Widget>[
      if (!warehouse) ...[
        _Metric(
          'Bugungi savdo',
          money(_amount(today['revenue'])),
          'Jami tushum',
          Icons.trending_up,
          _green,
        ),
        _Metric(
          'Sotuvlar soni',
          '${today['salesCount'] ?? 0} ta',
          'Bugungi cheklar',
          Icons.receipt_long_outlined,
          _ink,
        ),
      ],
      _Metric(
        'Ombordagi turlar',
        '${inventory['totalProductsCount'] ?? data.products.length} ta',
        'Faol mahsulotlar',
        Icons.inventory_2_outlined,
        _ink,
      ),
      _Metric(
        'Kam qolgan',
        '${inventory['lowStockCount'] ?? 0} ta',
        'Minimal chegarada',
        Icons.warning_amber_rounded,
        const Color(0xffa16207),
      ),
      _Metric(
        'Muddati yaqin',
        '${inventory['approachingExpiryCount'] ?? 0} ta',
        '90 kun ichida',
        Icons.schedule,
        const Color(0xffbe123c),
      ),
      if (warehouse)
        _Metric(
          'Muddati o‘tgan',
          '${inventory['expiredCount'] ?? 0} ta',
          'Sotuvga chiqarilmaydi',
          Icons.event_busy_outlined,
          const Color(0xffbe123c),
        )
      else
        _Metric(
          'Bugungi sof foyda',
          money(_amount(today['profit'])),
          'Chiqimlar ayirilganda',
          Icons.account_balance_wallet_outlined,
          _green,
        ),
    ];
    return RefreshIndicator(
      onRefresh: data.refresh,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 28),
        children: [
          Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 1240),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    warehouse
                        ? 'Ombor boshqaruv paneli'
                        : 'Do‘kon boshqaruv dashboardi',
                    style: const TextStyle(
                      fontSize: 24,
                      fontWeight: FontWeight.w800,
                      color: _ink,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '${data.user['shopName'] ?? data.user['fullName'] ?? 'Savdoza'} · ${data.online ? 'Online' : 'Saqlangan ko‘rsatkichlar'}',
                    style: const TextStyle(color: _muted),
                  ),
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 10,
                    runSpacing: 10,
                    children: [
                      if (data.sell)
                        FilledButton.icon(
                          onPressed: () => onNavigate('pos'),
                          icon: const Icon(Icons.point_of_sale, size: 19),
                          label: const Text('Savdo (POS)'),
                        ),
                      OutlinedButton.icon(
                        onPressed: data.refreshing ? null : data.refresh,
                        icon: const Icon(Icons.refresh, size: 19),
                        label: Text(
                          data.refreshing ? 'Yangilanmoqda' : 'Yangilash',
                        ),
                      ),
                    ],
                  ),
                  if (data.pending.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Card(
                      margin: EdgeInsets.zero,
                      color: const Color(0xfffff7e5),
                      child: ListTile(
                        leading: const Icon(
                          Icons.sync,
                          color: Color(0xffa16207),
                        ),
                        title: Text(
                          '${data.pending.length} ta savdo yuborilmoqda',
                        ),
                        subtitle: const Text(
                          'Internet bo‘lganda avtomatik sinxronlanadi',
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () => onNavigate('queue'),
                      ),
                    ),
                  ],
                  const SizedBox(height: 20),
                  LayoutBuilder(
                    builder: (context, constraints) {
                      final columns = constraints.maxWidth >= 1100
                          ? 6
                          : constraints.maxWidth >= 650
                          ? 3
                          : 2;
                      return Column(
                        children: [
                          for (
                            var start = 0;
                            start < metrics.length;
                            start += columns
                          )
                            Padding(
                              padding: EdgeInsets.only(
                                bottom: start + columns < metrics.length
                                    ? 12
                                    : 0,
                              ),
                              child: IntrinsicHeight(
                                child: Row(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.stretch,
                                  children: [
                                    for (
                                      var column = 0;
                                      column < columns;
                                      column++
                                    ) ...[
                                      if (column > 0) const SizedBox(width: 12),
                                      Expanded(
                                        child: start + column < metrics.length
                                            ? metrics[start + column]
                                            : const SizedBox(),
                                      ),
                                    ],
                                  ],
                                ),
                              ),
                            ),
                        ],
                      );
                    },
                  ),
                  const SizedBox(height: 20),
                  if (warehouse)
                    _Panel(
                      title: 'Ombor va partiyalar',
                      icon: Icons.warehouse_outlined,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Partiyalar qoldig‘i va yaroqlilik muddatlarini nazorat qiling.',
                            style: TextStyle(color: _muted),
                          ),
                          const SizedBox(height: 16),
                          OutlinedButton(
                            onPressed: () => onNavigate('batches'),
                            child: const Text('Omborni ochish'),
                          ),
                        ],
                      ),
                    )
                  else ...[
                    LayoutBuilder(
                      builder: (context, constraints) {
                        final chart = _RevenueChart(
                          rows: records(report['last7DaysTrend']),
                        );
                        final products = _TopProducts(
                          rows: records(report['topProducts']),
                          today: today,
                          onReturns: () => onNavigate('returns'),
                        );
                        if (constraints.maxWidth < 900) {
                          return Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              chart,
                              const SizedBox(height: 16),
                              products,
                            ],
                          );
                        }
                        return Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Expanded(flex: 2, child: chart),
                            const SizedBox(width: 16),
                            Expanded(child: products),
                          ],
                        );
                      },
                    ),
                    const SizedBox(height: 20),
                    _Panel(
                      title: 'Kassirlar bo‘yicha savdo natijalari',
                      subtitle: 'Oylik sotuvlar va umumiy tushum',
                      icon: Icons.people_outline,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          if (data.owner)
                            Align(
                              alignment: Alignment.centerLeft,
                              child: TextButton.icon(
                                onPressed: data.max
                                    ? () => onNavigate('staff')
                                    : null,
                                icon: Icon(
                                  data.max
                                      ? Icons.badge_outlined
                                      : Icons.lock_outline,
                                  size: 18,
                                ),
                                label: Text(
                                  data.max
                                      ? 'Xodimlarni boshqarish'
                                      : 'Xodimlar · Max tarifida',
                                ),
                              ),
                            ),
                          if (records(report['cashiersStats']).isEmpty)
                            const Padding(
                              padding: EdgeInsets.symmetric(vertical: 24),
                              child: Text(
                                'Kassirlar faoliyati hali qayd etilmadi.',
                                style: TextStyle(color: _muted),
                              ),
                            )
                          else
                            SingleChildScrollView(
                              scrollDirection: Axis.horizontal,
                              child: DataTable(
                                columnSpacing: 24,
                                horizontalMargin: 0,
                                columns: const [
                                  DataColumn(label: Text('Kassir')),
                                  DataColumn(label: Text('Login')),
                                  DataColumn(
                                    label: Text('Sotuvlar'),
                                    numeric: true,
                                  ),
                                  DataColumn(
                                    label: Text('Tovarlar'),
                                    numeric: true,
                                  ),
                                  DataColumn(
                                    label: Text('Tushum'),
                                    numeric: true,
                                  ),
                                ],
                                rows: [
                                  for (final cashier in records(
                                    report['cashiersStats'],
                                  ))
                                    DataRow(
                                      cells: [
                                        DataCell(
                                          Text('${cashier['fullName'] ?? ''}'),
                                        ),
                                        DataCell(
                                          Text('${cashier['username'] ?? ''}'),
                                        ),
                                        DataCell(
                                          Text(
                                            '${cashier['salesCount'] ?? 0} ta',
                                          ),
                                        ),
                                        DataCell(
                                          Text(
                                            '${cashier['totalItemsSold'] ?? 0}',
                                          ),
                                        ),
                                        DataCell(
                                          Text(
                                            money(
                                              _amount(cashier['totalRevenue']),
                                            ),
                                          ),
                                        ),
                                      ],
                                    ),
                                ],
                              ),
                            ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Metric extends StatelessWidget {
  const _Metric(this.title, this.value, this.caption, this.icon, this.color);
  final String title, value, caption;
  final IconData icon;
  final Color color;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 22, color: color),
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: _muted,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: color,
            ),
          ),
          const SizedBox(height: 4),
          Text(caption, style: const TextStyle(fontSize: 11, color: _muted)),
        ],
      ),
    ),
  );
}

class _Panel extends StatelessWidget {
  const _Panel({
    required this.title,
    required this.icon,
    required this.child,
    this.subtitle,
  });
  final String title;
  final String? subtitle;
  final IconData icon;
  final Widget child;

  @override
  Widget build(BuildContext context) => Card(
    margin: EdgeInsets.zero,
    child: Padding(
      padding: const EdgeInsets.all(18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                    fontWeight: FontWeight.w700,
                    fontSize: 16,
                    color: _ink,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Icon(icon, color: _green, size: 21),
            ],
          ),
          if (subtitle != null)
            Padding(
              padding: const EdgeInsets.only(top: 5),
              child: Text(
                subtitle!,
                style: const TextStyle(color: _muted, fontSize: 12),
              ),
            ),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 10),
            child: Divider(height: 1),
          ),
          child,
        ],
      ),
    ),
  );
}

class _RevenueChart extends StatelessWidget {
  const _RevenueChart({required this.rows});
  final List<Json> rows;

  @override
  Widget build(BuildContext context) {
    final days = rows.take(7).toList();
    final maxRevenue = days.fold<double>(
      1,
      (current, day) => math.max(current, _amount(day['revenue']).toDouble()),
    );
    return _Panel(
      title: 'Oxirgi 7 kunlik savdo grafigi',
      subtitle: 'Kunlar bo‘yicha tushum dinamikasi',
      icon: Icons.trending_up,
      child: days.isEmpty
          ? const SizedBox(
              height: 180,
              child: Center(
                child: Text(
                  'Savdo ma’lumotlari hali mavjud emas.',
                  style: TextStyle(color: _muted),
                ),
              ),
            )
          : Padding(
              padding: const EdgeInsets.only(top: 12),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  for (final day in days)
                    Expanded(
                      child: Semantics(
                        label:
                            '${day['label']}. ${money(_amount(day['revenue']))}. ${day['count'] ?? 0} ta sotuv.',
                        child: Tooltip(
                          message:
                              '${money(_amount(day['revenue']))} · ${day['count'] ?? 0} ta sotuv',
                          child: Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 4),
                            child: Column(
                              children: [
                                SizedBox(
                                  height: 160,
                                  child: Align(
                                    alignment: Alignment.bottomCenter,
                                    child: AnimatedContainer(
                                      duration: const Duration(
                                        milliseconds: 350,
                                      ),
                                      height: _amount(day['revenue']) <= 0
                                          ? 2
                                          : math.max(
                                              4,
                                              _amount(day['revenue']) /
                                                  maxRevenue *
                                                  160,
                                            ),
                                      constraints: const BoxConstraints(
                                        maxWidth: 38,
                                      ),
                                      decoration: BoxDecoration(
                                        color: _amount(day['revenue']) <= 0
                                            ? const Color(0xffe2e8f0)
                                            : _green,
                                        borderRadius: BorderRadius.circular(6),
                                      ),
                                    ),
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Text(
                                  '${day['label'] ?? ''}',
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    fontSize: 11,
                                    color: _muted,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
    );
  }
}

class _TopProducts extends StatelessWidget {
  const _TopProducts({
    required this.rows,
    required this.today,
    required this.onReturns,
  });
  final List<Json> rows;
  final Json today;
  final VoidCallback onReturns;

  @override
  Widget build(BuildContext context) => _Panel(
    title: 'Eng ko‘p sotilgan mahsulotlar',
    icon: Icons.inventory_2_outlined,
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        if (rows.isEmpty)
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 24),
            child: Text(
              'Ushbu oyda hali sotuvlar amalga oshirilmagan.',
              style: TextStyle(color: _muted),
            ),
          ),
        for (final product in rows.take(5))
          Padding(
            padding: const EdgeInsets.symmetric(vertical: 10),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        '${product['name'] ?? ''}',
                        style: const TextStyle(fontWeight: FontWeight.w600),
                      ),
                      Text(
                        '${product['totalQuantity'] ?? 0} ${product['unit'] ?? ''} sotildi',
                        style: const TextStyle(fontSize: 12, color: _muted),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: Text(
                    money(_amount(product['totalRevenue'])),
                    textAlign: TextAlign.right,
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: _green,
                    ),
                  ),
                ),
              ],
            ),
          ),
        const Divider(),
        TextButton.icon(
          onPressed: onReturns,
          icon: const Icon(Icons.keyboard_return, size: 18),
          label: Text('Qaytarishlar · ${today['refundCount'] ?? 0} ta bugun'),
        ),
        Text(
          money(_amount(today['refundTotal'])),
          textAlign: TextAlign.right,
          style: const TextStyle(color: _muted, fontSize: 12),
        ),
      ],
    ),
  );
}
