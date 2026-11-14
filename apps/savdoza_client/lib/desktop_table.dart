import 'dart:math' as math;

import 'package:flutter/material.dart';

import 'data.dart';

List<(String, String)> _columns(String section) => switch (section) {
  'products' => [
    ('name', 'Mahsulot'),
    ('barcode', 'Shtrix-kod'),
    ('salePrice', 'Narx'),
    ('totalStock', 'Qoldiq'),
    ('status', 'Holat'),
  ],
  'batches' => [
    ('product.name', 'Mahsulot'),
    ('batchNumber', 'Partiya'),
    ('currentQuantity', 'Qoldiq'),
    ('salePrice', 'Narx'),
    ('expiryDate', 'Yaroqlilik muddati'),
  ],
  'categories' => [('name', 'Kategoriya'), ('_count.products', 'Mahsulotlar')],
  'manufacturers' => [
    ('name', 'Ishlab chiqaruvchi'),
    ('country', 'Davlat'),
    ('_count.products', 'Mahsulotlar'),
  ],
  'customers' => [
    ('name', 'Mijoz'),
    ('phone', 'Telefon'),
    ('totalSpent', 'Xaridlar summasi'),
  ],
  'debts' => [
    ('firstName', 'Ism'),
    ('lastName', 'Familiya'),
    ('phone', 'Telefon'),
    ('amount', 'Qarz'),
    ('status', 'Holat'),
  ],
  'staff' => [
    ('fullName', 'Xodim'),
    ('username', 'Login'),
    ('role', 'Lavozim'),
    ('status', 'Holat'),
  ],
  'notifications' => [
    ('title', 'Xabar'),
    ('message', 'Matn'),
    ('createdAt', 'Vaqt'),
  ],
  'shops' => [
    ('name', 'Do‘kon'),
    ('adminName', 'Egasi'),
    ('phone', 'Telefon'),
    ('planCode', 'Tarif'),
    ('subscriptionEndDate', 'Amal qilish muddati'),
  ],
  _ => [('name', 'Nomi'), ('phone', 'Telefon'), ('status', 'Holat')],
};

String _cell(Json row, String field) {
  dynamic value = row;
  for (final part in field.split('.')) {
    value = object(value)[part];
  }
  if (value == null) return '—';
  if (['salePrice', 'amount', 'totalSpent'].contains(field) && value is num)
    return money(value);
  if (['expiryDate', 'createdAt', 'subscriptionEndDate'].contains(field))
    return dateText(value);
  if (field == 'status')
    return {
          'ACTIVE': 'Faol',
          'INACTIVE': 'Nofaol',
          'PAID': 'To‘langan',
          'OPEN': 'Ochiq',
          'NORMAL': 'Yaroqli',
        }['$value'] ??
        '$value';
  return '$value';
}

class DesktopRecordsTable extends StatefulWidget {
  const DesktopRecordsTable({
    super.key,
    required this.rows,
    required this.title,
    required this.actions,
    this.section = '',
  });
  final List<Json> rows;
  final String title, section;
  final Widget Function(Json) actions;
  @override
  State<DesktopRecordsTable> createState() => _DesktopRecordsTableState();
}

class _DesktopRecordsTableState extends State<DesktopRecordsTable> {
  late final _RecordSource source;
  int pageSize = 20;
  @override
  void initState() {
    super.initState();
    source = _RecordSource(
      widget.rows,
      _columns(widget.section),
      widget.actions,
    );
  }

  @override
  void didUpdateWidget(DesktopRecordsTable oldWidget) {
    super.didUpdateWidget(oldWidget);
    source.update(widget.rows, widget.actions);
  }

  @override
  void dispose() {
    source.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.rows.isEmpty)
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.inbox_outlined,
                size: 48,
                color: Colors.blueGrey,
              ),
              const SizedBox(height: 16),
              Text(
                '${widget.title} hozircha yo‘q',
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Yozuvlar qo‘shilganda shu yerda ko‘rinadi.',
                style: TextStyle(color: Colors.blueGrey),
              ),
            ],
          ),
        ),
      );
    final count = math.min(pageSize, widget.rows.length);
    final sizes = {
      count,
      10,
      20,
      50,
    }.where((value) => value <= widget.rows.length).toList()..sort();
    return LayoutBuilder(
      builder: (context, constraints) => SingleChildScrollView(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
        child: SizedBox(
          width: constraints.maxWidth - 32,
          child: PaginatedDataTable(
            header: Text(
              '${widget.title} · ${widget.rows.length} ta',
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            columns: [
              for (final column in source.columns)
                DataColumn(label: Text(column.$2)),
              const DataColumn(label: Text('Amallar')),
            ],
            source: source,
            rowsPerPage: count,
            availableRowsPerPage: sizes,
            showEmptyRows: false,
            showFirstLastButtons: true,
            dataRowMinHeight: 64,
            dataRowMaxHeight: 92,
            headingRowColor: const WidgetStatePropertyAll(Color(0xfff4f6f8)),
            columnSpacing: 24,
            onRowsPerPageChanged: (value) {
              if (value != null) setState(() => pageSize = value);
            },
          ),
        ),
      ),
    );
  }
}

class _RecordSource extends DataTableSource {
  _RecordSource(this.rows, this.columns, this.actions);
  List<Json> rows;
  final List<(String, String)> columns;
  Widget Function(Json) actions;
  void update(List<Json> records, Widget Function(Json) builder) {
    rows = records;
    actions = builder;
    notifyListeners();
  }

  @override
  DataRow? getRow(int index) {
    if (index >= rows.length) return null;
    final row = rows[index];
    return DataRow.byIndex(
      index: index,
      cells: [
        for (final column in columns)
          DataCell(
            ConstrainedBox(
              constraints: const BoxConstraints(minWidth: 100, maxWidth: 240),
              child: Tooltip(
                message: _cell(row, column.$1),
                child: Text(
                  _cell(row, column.$1),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ),
          ),
        DataCell(
          ConstrainedBox(
            constraints: const BoxConstraints(minWidth: 220, maxWidth: 320),
            child: actions(row),
          ),
        ),
      ],
    );
  }

  @override
  int get rowCount => rows.length;
  @override
  bool get isRowCountApproximate => false;
  @override
  int get selectedRowCount => 0;
}
