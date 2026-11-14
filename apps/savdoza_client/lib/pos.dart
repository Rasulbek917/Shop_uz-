import 'package:flutter/material.dart';

import 'data.dart';
import 'widgets.dart';

class CartLine {
  CartLine(this.product, this.batch);
  final Json product, batch;
  int quantity = 1;
  num get price => product['salePrice'] as num;
  Json payload() => {
    'productId': product['id'],
    'batchId': batch['id'],
    'quantity': quantity,
    'unitPrice': price,
    'discount': 0,
  };
  Json receipt() => {
    'productName': product['name'],
    'quantity': quantity,
    'unitPrice': price,
    'discount': 0,
    'totalPrice': (price * quantity).round(),
  };
}

class PosPage extends StatefulWidget {
  const PosPage({super.key, required this.data});
  final AppData data;
  @override
  State<PosPage> createState() => _PosPageState();
}

class _PosPageState extends State<PosPage> {
  final search = TextEditingController();
  final discount = TextEditingController(text: '0');
  final paid = TextEditingController();
  final List<CartLine> cart = [];
  String payment = 'CASH', category = '', customer = '';
  bool saving = false, showCart = false;
  num get reduction => num.tryParse(discount.text) ?? 0;
  Json get settings => object(widget.data.cache['shopSettings']);
  num get taxRate => settings['taxRate'] as num? ?? 0;
  SaleTotals get totals => SaleTotals(
    cart.map((line) => line.payload()).toList(),
    reduction,
    taxRate,
    settings['taxIncluded'] == true,
  );
  num get subtotal => totals.subtotal;
  num get tax => totals.tax;
  num get total => totals.total;
  @override
  void dispose() {
    search.dispose();
    discount.dispose();
    paid.dispose();
    super.dispose();
  }

  void add(Json product) {
    final batches = records(product['batches'])
        .where(
          (batch) =>
              (batch['currentQuantity'] as num) > 0 &&
              (DateTime.tryParse('${batch['expiryDate']}')
                      ?.isAfter(DateTime.now()) ??
                  false),
        )
        .toList();
    batches.sort(
      (a, b) => '${a['expiryDate']}'.compareTo('${b['expiryDate']}'),
    );
    for (final batch in batches) {
      final existing = cart
          .where((line) => line.batch['id'] == batch['id'])
          .firstOrNull;
      if (existing == null) {
        setState(() => cart.add(CartLine(product, batch)));
        return;
      }
      if (existing.quantity < (batch['currentQuantity'] as num)) {
        setState(() => existing.quantity++);
        return;
      }
    }
    message(context, 'Yaroqli qoldiq yetarli emas');
  }

  Future<void> scan([String? value]) async {
    final code =
        value ??
        await Navigator.push<String>(
          context,
          MaterialPageRoute(builder: (_) => const ScannerPage()),
        );
    if (code == null || code.trim().isEmpty) return;
    final product = widget.data.products
        .where(
          (product) =>
              product['barcode'] == code.trim() ||
              product['qrCode'] == code.trim() ||
              product['sku'] == code.trim(),
        )
        .firstOrNull;
    if (product != null) {
      add(product);
      search.clear();
      return;
    }
    if (!widget.data.online) {
      if (mounted) {
        await message(context, 'Mahsulot saqlangan katalogda topilmadi');
      }
      return;
    }
    try {
      final central = object(
        await widget.data.get(
          '/api/products/central-lookup?code=${Uri.encodeComponent(code)}',
        ),
      );
      if (!mounted) return;
      if (!widget.data.max) {
        await message(context, 'Markaziy bazadan import Max tarifida ochiladi');
        return;
      }
      final input = await editForm(
        context,
        '${central['name']} · Import',
        const [
          Field('salePrice', 'Sotuv narxi', number: true, required: true),
          Field(
            'initialStock',
            'Boshlang‘ich qoldiq',
            number: true,
            integer: true,
            required: true,
          ),
        ],
        values: {'salePrice': central['price'] ?? 0, 'initialStock': 1},
      );
      if (input == null) return;
      await widget.data.api.call(
        '/api/products/central-import',
        method: 'POST',
        body: {
          ...input,
          'sku': central['sku'],
          'name': central['name'],
          'barcodeValue': central['barcodeValue'],
          'barcodeType': central['barcodeType'],
          'unit': 'dona',
          'brandName': central['brand'],
          'categoryName': central['category'],
        },
      );
      await widget.data.refresh();
    } catch (error) {
      if (mounted) await message(context, error);
    }
  }

  Future<void> checkout(bool debt) async {
    if (saving || cart.isEmpty) return;
    if (!widget.data.access || !widget.data.sell) {
      await message(context, 'Faol hisob va tarif kerak');
      return;
    }
    if (reduction < 0 || reduction > subtotal) {
      await message(context, 'Chegirmani tekshiring');
      return;
    }
    if (widget.data.user['role'] == 'CASHIER' && reduction > subtotal * .15) {
      await message(context, 'Kassir uchun chegirma chegarasi 15%');
      return;
    }
    for (final line in cart) {
      final product = widget.data.products
          .where((p) => p['id'] == line.product['id'])
          .firstOrNull;
      final batch = records(product?['batches'])
          .where((b) => b['id'] == line.batch['id'])
          .firstOrNull;
      if (batch == null ||
          (batch['currentQuantity'] as num) < line.quantity ||
          !DateTime.parse('${batch['expiryDate']}').isAfter(DateTime.now())) {
        await message(
          context,
          '${line.product['name']} qoldig‘ini yoki muddatini tekshiring',
        );
        return;
      }
    }
    setState(() => saving = true);
    try {
      Json extra;
      if (debt) {
        final form = await editForm(context, 'Nasiya savdosi', const [
          Field('firstName', 'Ism', required: true),
          Field('lastName', 'Familiya', required: true),
          Field('phone', 'Telefon'),
        ]);
        if (form == null) return;
        extra = form;
      } else {
        paid.text = '$total';
        final form = await editForm(
          context,
          'To‘lovni qayd etish',
          const [
            Field(
              'paidAmount',
              'Qabul qilingan summa',
              number: true,
              required: true,
            ),
          ],
          values: {'paidAmount': total},
        );
        if (form == null) return;
        extra = form;
        if ((extra['paidAmount'] as num) < total) {
          if (mounted) {
            await message(context, 'To‘langan summa jami summadan kam');
          }
          return;
        }
      }
      final occurredAt = DateTime.now().toUtc().toIso8601String();
      final amountPaid = debt ? 0 : extra['paidAmount'] as num;
      final payload = {
        ...extra,
        'paymentMethod': payment,
        'customerId': customer.isEmpty ? null : customer,
        'discountAmount': reduction,
        'expectedTotal': total,
        'items': cart.map((line) => line.payload()).toList(),
      };
      final receipt = {
        'shopName': settings['name'] ?? widget.data.user['shopName'],
        'shopAddress': settings['address'],
        'cashierName': widget.data.user['fullName'],
        'createdAt': occurredAt,
        'totalAmount': subtotal,
        'discountAmount': reduction,
        'taxAmount': tax,
        'payableAmount': total,
        'paidAmount': amountPaid,
        'changeAmount': debt ? 0 : amountPaid - total,
        'paymentMethod': debt ? 'DEBT' : payment,
        'items': cart.map((line) => line.receipt()).toList(),
      };
      await widget.data.enqueue(payload, receipt, debt: debt);
      final saved = widget.data.orders.last;
      setState(() {
        cart.clear();
        discount.text = '0';
        customer = '';
      });
      if (mounted) {
        await showReceipt(
          context,
          widget.data,
          object(saved['receipt']),
          pending: true,
        );
      }
    } catch (error) {
      if (mounted) await message(context, error);
    } finally {
      if (mounted) setState(() => saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final products = widget.data.products
        .where(
          (product) =>
              (category.isEmpty || product['categoryId'] == category) &&
              ('${product['name']} ${product['barcode']} ${product['qrCode']}'
                  .toLowerCase()
                  .contains(search.text.toLowerCase())),
        )
        .toList();
    final catalog = Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  controller: search,
                  onChanged: (_) => setState(() {}),
                  onSubmitted: (code) => scan(code),
                  decoration: const InputDecoration(
                    labelText: 'Mahsulot yoki shtrix-kod',
                    prefixIcon: Icon(Icons.search),
                  ),
                ),
              ),
              IconButton(
                onPressed: saving ? null : scan,
                tooltip: 'Kamera skaneri',
                icon: const Icon(Icons.qr_code_scanner),
              ),
            ],
          ),
        ),
        SizedBox(
          height: 48,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            children: [
              ChoiceChip(
                label: const Text('Barchasi'),
                selected: category.isEmpty,
                onSelected: (_) => setState(() => category = ''),
              ),
              for (final item in records(widget.data.cache['categories']))
                Padding(
                  padding: const EdgeInsets.only(left: 8),
                  child: ChoiceChip(
                    label: Text('${item['name']}'),
                    selected: category == item['id'],
                    onSelected: (_) =>
                        setState(() => category = '${item['id']}'),
                  ),
                ),
            ],
          ),
        ),
        Expanded(
          child: GridView.builder(
            padding: const EdgeInsets.all(12),
            gridDelegate: const SliverGridDelegateWithMaxCrossAxisExtent(
              maxCrossAxisExtent: 230,
              mainAxisExtent: 146,
              mainAxisSpacing: 8,
              crossAxisSpacing: 8,
            ),
            itemCount: products.length,
            itemBuilder: (context, index) {
              final product = products[index];
              return Card(
                child: InkWell(
                  onTap: saving ? null : () => add(product),
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${product['name']}',
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                        const Spacer(),
                        Text(
                          money(product['salePrice'] as num),
                          style: const TextStyle(
                            color: Color(0xff24634f),
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text('Qoldiq ${product['totalStock']}'),
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
    final basket = SingleChildScrollView(
      child: Column(
        children: [
          const ListTile(
            leading: Icon(Icons.shopping_basket_outlined),
            title: Text(
              'Savat',
              style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
          ),
          ListView(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            children: [
              for (final line in cart)
                ListTile(
                  title: Text('${line.product['name']}'),
                  subtitle: Text(money(line.price * line.quantity)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(
                        onPressed: saving
                            ? null
                            : () => setState(() {
                                line.quantity--;
                                if (line.quantity <= 0) cart.remove(line);
                              }),
                        icon: const Icon(Icons.remove_circle_outline),
                      ),
                      Text('${line.quantity}'),
                      IconButton(
                        onPressed: saving
                            ? null
                            : () {
                                final current = widget.data.products
                                    .where((p) => p['id'] == line.product['id'])
                                    .firstOrNull;
                                if (current != null) add(current);
                              },
                        icon: const Icon(Icons.add_circle_outline),
                      ),
                    ],
                  ),
                ),
            ],
          ),
          Padding(
            padding: const EdgeInsets.all(12),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                DropdownButtonFormField<String>(
                  key: ValueKey('customer-$customer'),
                  initialValue: customer,
                  isExpanded: true,
                  decoration: const InputDecoration(labelText: 'Mijoz'),
                  items: [
                    const DropdownMenuItem(
                      value: '',
                      child: Text('Oddiy xaridor'),
                    ),
                    ...records(widget.data.cache['customers']).map(
                      (row) => DropdownMenuItem(
                        value: '${row['id']}',
                        child: Text('${row['name']}'),
                      ),
                    ),
                  ],
                  onChanged: saving
                      ? null
                      : (value) => setState(() => customer = value ?? ''),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: discount,
                        keyboardType: TextInputType.number,
                        onChanged: (_) => setState(() {}),
                        decoration: const InputDecoration(
                          labelText: 'Chegirma (so‘m)',
                        ),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Text(
                      'Jami ${money(total)}',
                      style: const TextStyle(
                        fontWeight: FontWeight.bold,
                        fontSize: 18,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                DropdownButtonFormField<String>(
                  initialValue: payment,
                  decoration: const InputDecoration(labelText: 'To‘lov turi'),
                  items: const [
                    DropdownMenuItem(value: 'CASH', child: Text('Naqd')),
                    DropdownMenuItem(value: 'CARD', child: Text('Karta')),
                    DropdownMenuItem(
                      value: 'ELECTRONIC',
                      child: Text('Elektron to‘lov'),
                    ),
                  ],
                  onChanged: saving
                      ? null
                      : (value) => setState(() => payment = value!),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: FilledButton(
                        onPressed: saving || cart.isEmpty
                            ? null
                            : () => checkout(false),
                        child: Text(
                          saving ? 'Saqlanmoqda…' : 'Savdoni yakunlash',
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    OutlinedButton(
                      onPressed: saving || cart.isEmpty
                          ? null
                          : () => checkout(true),
                      child: const Text('Nasiya'),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
    return LayoutBuilder(
      builder: (context, size) => size.maxWidth >= 820
          ? Row(
              children: [
                Expanded(child: catalog),
                SizedBox(width: 370, child: basket),
              ],
            )
          : Column(
              children: [
                Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  child: SegmentedButton<bool>(
                    segments: [
                      const ButtonSegment(
                        value: false,
                        icon: Icon(Icons.inventory_2_outlined),
                        label: Text('Mahsulotlar'),
                      ),
                      ButtonSegment(
                        value: true,
                        icon: const Icon(Icons.shopping_basket_outlined),
                        label: Text('Savat (${cart.length})'),
                      ),
                    ],
                    selected: {showCart},
                    onSelectionChanged: (values) =>
                        setState(() => showCart = values.first),
                  ),
                ),
                Expanded(child: showCart ? basket : catalog),
              ],
            ),
    );
  }
}
