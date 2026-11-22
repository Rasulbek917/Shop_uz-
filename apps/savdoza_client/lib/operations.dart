import 'package:flutter/material.dart';

import 'data.dart';
import 'widgets.dart';

class ShiftPage extends StatefulWidget {
  const ShiftPage({super.key, required this.data});
  final AppData data;

  @override
  State<ShiftPage> createState() => _ShiftPageState();
}

class _ShiftPageState extends State<ShiftPage> {
  List<Json> shifts = [];
  bool loading = true;
  bool busy = false;
  String? error;

  Json? get active => shifts
      .where((shift) => shift['mine'] == true && shift['status'] == 'OPEN')
      .firstOrNull;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    if (mounted) setState(() => loading = true);
    try {
      final result = records(
        await widget.data.get('/api/shifts', cacheKey: 'shifts'),
      );
      if (mounted)
        setState(() {
          shifts = result;
          error = null;
        });
    } catch (cause) {
      if (mounted) setState(() => error = '$cause');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> openOrClose() async {
    if (busy || !widget.data.online) {
      await message(context, 'Smenani o‘zgartirish uchun internet kerak');
      return;
    }
    final shift = active;
    if (shift != null && widget.data.pending.isNotEmpty) {
      await message(context, 'Avval yuborilmagan savdolarni sinxronlang');
      return;
    }
    final input = await editForm(
      context,
      shift == null ? 'Smenani ochish' : 'Smenani yopish',
      shift == null
          ? const [
              Field(
                'openingCash',
                'Boshlang‘ich naqd',
                number: true,
                required: true,
              ),
            ]
          : const [
              Field(
                'closingCash',
                'Kassadagi haqiqiy naqd',
                number: true,
                required: true,
              ),
              Field('notes', 'Yopish izohi'),
            ],
      values: shift == null
          ? {'openingCash': 0}
          : {'closingCash': object(shift['summary'])['expectedCash'] ?? 0},
    );
    if (input == null) return;
    setState(() => busy = true);
    try {
      await widget.data.api.call(
        '/api/shifts',
        method: shift == null ? 'POST' : 'PATCH',
        body: shift == null ? input : {...input, 'shiftId': shift['id']},
      );
      await load();
      if (mounted)
        await message(
          context,
          shift == null ? 'Smena ochildi' : 'Smena yopildi',
        );
    } catch (cause) {
      if (mounted) await message(context, cause);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  Future<void> addMovement() async {
    if (busy || !widget.data.online) {
      await message(context, 'Kassa amali uchun internet kerak');
      return;
    }
    final input = await editForm(
      context,
      'Naqd tranzaksiya',
      const [
        Field(
          'type',
          'Tur',
          required: true,
          options: {'IN': 'Kirim', 'OUT': 'Chiqim'},
        ),
        Field('amount', 'Summa', number: true, required: true),
        Field('note', 'Izoh', required: true),
      ],
      values: {'type': 'IN'},
    );
    if (input == null) return;
    final amount = input['amount'] as num?;
    if (amount == null || amount <= 0 || '${input['note']}'.trim().length < 2) {
      if (mounted)
        await message(context, 'Summa va kamida 2 belgili izoh kiriting');
      return;
    }
    setState(() => busy = true);
    try {
      await widget.data.api.call(
        '/api/cash-movements',
        method: 'POST',
        body: input,
      );
      await load();
      if (mounted) await message(context, 'Kassa amali saqlandi');
    } catch (cause) {
      if (mounted) await message(context, cause);
    } finally {
      if (mounted) setState(() => busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final shift = active;
    final summary = object(shift?['summary']);
    final amounts = object(summary['amounts']);
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Smenalar',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ),
              IconButton(
                onPressed: loading ? null : load,
                tooltip: 'Yangilash',
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    shift == null ? 'Smena yopiq' : 'Smena ochiq',
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (shift != null) ...[
                    const SizedBox(height: 6),
                    Text(
                      '${object(shift['cashier'])['fullName'] ?? ''} · ${dateText(shift['openedAt'])}',
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 20,
                      runSpacing: 8,
                      children: [
                        Text('Cheklar: ${summary['salesCount'] ?? 0}'),
                        Text('Naqd: ${money((amounts['CASH'] as num?) ?? 0)}'),
                        Text('Karta: ${money((amounts['CARD'] as num?) ?? 0)}'),
                        Text(
                          'Kutilgan naqd: ${money((summary['expectedCash'] as num?) ?? 0)}',
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Text(
                      'Kirim: ${money((summary['cashIn'] as num?) ?? 0)} · Chiqim: ${money((summary['cashOut'] as num?) ?? 0)}',
                    ),
                  ],
                  const SizedBox(height: 16),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      FilledButton(
                        onPressed: busy || loading ? null : openOrClose,
                        child: Text(
                          shift == null ? 'Smenani ochish' : 'Smenani yopish',
                        ),
                      ),
                      if (shift != null)
                        OutlinedButton(
                          onPressed: busy ? null : addMovement,
                          child: const Text('Naqd kirim / chiqim'),
                        ),
                    ],
                  ),
                  if (shift != null && widget.data.pending.isNotEmpty)
                    const Padding(
                      padding: EdgeInsets.only(top: 8),
                      child: Text(
                        'Smenani yopishdan oldin savdolarni sinxronlang.',
                      ),
                    ),
                ],
              ),
            ),
          ),
          if (shift != null) ...[
            const SizedBox(height: 16),
            const Text(
              'Naqd tranzaksiyalar',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            for (final movement in records(shift['cashMovements']))
              ListTile(
                title: Text(
                  '${movement['type'] == 'IN' ? 'Kirim' : 'Chiqim'} · ${movement['note']}',
                ),
                subtitle: Text(dateText(movement['createdAt'])),
                trailing: Text(money((movement['amount'] as num?) ?? 0)),
              ),
          ],
          const SizedBox(height: 16),
          const Text(
            'Smena tarixi',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          if (!loading && shifts.isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Hali smena ochilmagan.'),
            ),
          for (final row in shifts)
            Card(
              child: ListTile(
                title: Text(
                  '${object(row['cashier'])['fullName'] ?? 'Kassir'} · ${row['status'] == 'OPEN' ? 'Ochiq' : 'Yopiq'}',
                ),
                subtitle: Text(
                  '${dateText(row['openedAt'])} — ${row['closedAt'] == null ? 'Hozir' : dateText(row['closedAt'])}',
                ),
                trailing: Text(
                  '${object(row['summary'])['salesCount'] ?? 0} chek',
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class FinancePage extends StatefulWidget {
  const FinancePage({super.key, required this.data});
  final AppData data;

  @override
  State<FinancePage> createState() => _FinancePageState();
}

class _FinancePageState extends State<FinancePage> {
  Json report = {};
  bool loading = true;
  bool monthly = false;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final value = object(
        await widget.data.get('/api/finance/summary', cacheKey: 'finance'),
      );
      if (mounted)
        setState(() {
          report = value;
          error = null;
        });
    } catch (cause) {
      if (mounted) setState(() => error = '$cause');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final period = object(report[monthly ? 'month' : 'today']);
    final methods = records(period['methods']);
    final total = methods.fold<num>(
      0,
      (sum, row) => sum + ((row['amount'] as num?) ?? 0),
    );
    final count = methods.fold<num>(
      0,
      (sum, row) => sum + ((row['count'] as num?) ?? 0),
    );
    final receivables = object(report['receivables']);
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Moliya nazorati',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ),
              IconButton(
                onPressed: loading ? null : load,
                tooltip: 'Yangilash',
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
          SegmentedButton<bool>(
            segments: const [
              ButtonSegment(value: false, label: Text('Bugun')),
              ButtonSegment(value: true, label: Text('Shu oy')),
            ],
            selected: {monthly},
            onSelectionChanged: (value) =>
                setState(() => monthly = value.first),
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _MetricCard('Sotuv summasi', money(total), '$count ta chek'),
              _MetricCard(
                'Qaytarishlar',
                money((period['refunds'] as num?) ?? 0),
                'Naqd: ${money((period['cashRefunds'] as num?) ?? 0)}',
              ),
              _MetricCard(
                'Mijozlar qarzi',
                money((receivables['amount'] as num?) ?? 0),
                '${receivables['count'] ?? 0} ta ochiq qarz',
              ),
              _MetricCard(
                'Ta’minotchi qarzi',
                money((report['supplierDebt'] as num?) ?? 0),
                'Jami qarz',
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Text(
            'To‘lov turlari',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          for (final method in methods.map((row) => '${row['method']}'))
            ListTile(
              title: Text(
                {
                      'CASH': 'Naqd',
                      'CARD': 'Karta',
                      'ELECTRONIC': 'Elektron',
                      'DEBT': 'Qarzga',
                      'MIXED': 'Aralash',
                    }[method] ??
                    method,
              ),
              subtitle: Text(
                '${methods.where((row) => row['method'] == method).firstOrNull?['count'] ?? 0} ta chek',
              ),
              trailing: Text(
                money(
                  (methods
                              .where((row) => row['method'] == method)
                              .firstOrNull?['amount']
                          as num?) ??
                      0,
                ),
              ),
            ),
          const SizedBox(height: 16),
          const Text(
            'So‘nggi savdolar',
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
          ),
          if (!loading && records(report['recentSales']).isEmpty)
            const Padding(
              padding: EdgeInsets.all(16),
              child: Text('Hali savdo yo‘q.'),
            ),
          for (final sale in records(report['recentSales']))
            Card(
              child: ListTile(
                title: Text(
                  '${sale['receiptNumber']} · ${money((sale['payableAmount'] as num?) ?? 0)}',
                ),
                subtitle: Text(
                  '${dateText(sale['createdAt'])} · ${object(sale['cashier'])['fullName'] ?? ''}',
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard(this.title, this.value, this.detail);
  final String title, value, detail;

  @override
  Widget build(BuildContext context) => SizedBox(
    width: 220,
    child: Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: const TextStyle(color: Colors.blueGrey)),
            const SizedBox(height: 6),
            Text(
              value,
              style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
            ),
            Text(
              detail,
              style: const TextStyle(fontSize: 12, color: Colors.blueGrey),
            ),
          ],
        ),
      ),
    ),
  );
}
