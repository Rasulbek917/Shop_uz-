import 'package:flutter/material.dart';

import 'data.dart';

class DesktopRecordsTable extends StatefulWidget {
  const DesktopRecordsTable({
    super.key,
    required this.rows,
    required this.title,
    required this.actions,
  });
  final List<Json> rows;
  final String title;
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
    source = _RecordSource(widget.rows, widget.actions);
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
  Widget build(BuildContext context) => SingleChildScrollView(
    padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
    child: PaginatedDataTable(
      header: Text(
        '${widget.title} · ${widget.rows.length} ta',
        style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
      ),
      columns: const [
        DataColumn(label: Text('Nomi')),
        DataColumn(label: Text('Ma’lumotlar')),
        DataColumn(label: Text('Amallar')),
      ],
      source: source,
      rowsPerPage: pageSize,
      availableRowsPerPage: const [10, 20, 50],
      showEmptyRows: false,
      showFirstLastButtons: true,
      dataRowMinHeight: 64,
      dataRowMaxHeight: 100,
      onRowsPerPageChanged: (value) {
        if (value != null) setState(() => pageSize = value);
      },
    ),
  );
}

class _RecordSource extends DataTableSource {
  _RecordSource(this.rows, this.actions);
  List<Json> rows;
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
    final name =
        '${row['name'] ?? row['fullName'] ?? row['title'] ?? row['firstName'] ?? row['action'] ?? row['batchNumber'] ?? row['id']}';
    final details = [
      if (row['salePrice'] is num) money(row['salePrice']),
      if (row['amount'] is num) money(row['amount']),
      if (row['totalStock'] != null) 'Qoldiq ${row['totalStock']}',
      if (row['currentQuantity'] != null) 'Qoldiq ${row['currentQuantity']}',
      if (row['phone'] != null) '${row['phone']}',
      if (row['username'] != null) '${row['username']}',
      if (row['role'] != null) '${row['role']}',
      if (row['status'] != null) '${row['status']}',
      if (row['message'] != null) '${row['message']}',
      if (row['details'] != null) '${row['details']}',
      if (row['expiryDate'] != null) dateText(row['expiryDate']),
    ].join(' · ');
    return DataRow.byIndex(
      index: index,
      cells: [
        DataCell(
          SizedBox(
            width: 240,
            child: Tooltip(
              message: name,
              child: Text(
                name,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(fontWeight: FontWeight.w600),
              ),
            ),
          ),
        ),
        DataCell(
          SizedBox(
            width: 340,
            child: Tooltip(
              message: details,
              child: Text(
                details,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        ),
        DataCell(SizedBox(width: 340, child: actions(row))),
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
