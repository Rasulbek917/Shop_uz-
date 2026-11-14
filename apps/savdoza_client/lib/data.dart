import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:math';

import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

const serverUrl = String.fromEnvironment(
  'API_URL',
  defaultValue: 'https://shop.aminboyevrasulbek.uz',
);
const device = MethodChannel('savdoza/device');
typedef Json = Map<String, dynamic>;
Json object(dynamic value) =>
    value is Map ? Map<String, dynamic>.from(value) : {};
List<Json> records(dynamic value) =>
    value is List ? value.map(object).toList() : [];
String money(num value) =>
    '${value.round().toString().replaceAllMapped(RegExp(r'(\d)(?=(\d{3})+(?!\d))'), (match) => '${match[1]} ')} so‘m';
String saleKey() =>
    'MOB-${List.generate(32, (_) => Random.secure().nextInt(256).toRadixString(16).padLeft(2, '0')).join()}';
String dateText(dynamic value) {
  final date = DateTime.tryParse('$value')
      ?.toUtc()
      .add(const Duration(hours: 5));
  if (date == null) return '—';
  String two(int n) => '$n'.padLeft(2, '0');
  return '${two(date.day)}.${two(date.month)}.${date.year} ${two(date.hour)}:${two(date.minute)}';
}

class ApiError implements Exception {
  ApiError(this.status, this.message);
  final int status;
  final String message;
  @override
  String toString() => message;
}

class Api {
  Api({this.cookie});
  String? cookie;
  final client = HttpClient()..connectionTimeout = const Duration(seconds: 12);
  Future<Json> call(String path, {String method = 'GET', Json? body}) async {
    final uri = Uri.parse('$serverUrl$path');
    if (uri.scheme != 'https' || uri.origin != Uri.parse(serverUrl).origin) {
      throw ApiError(400, 'Server manzili noto‘g‘ri');
    }
    final request = await client
        .openUrl(method, uri)
        .timeout(const Duration(seconds: 15));
    request.followRedirects = false;
    if (cookie != null) request.headers.set('Cookie', cookie!);
    request.headers.set('Accept', 'application/json');
    if (body != null) {
      request.headers.contentType = ContentType.json;
      request.write(jsonEncode(body));
    }
    final response = await request.close().timeout(const Duration(seconds: 25));
    final text = await response
        .transform(utf8.decoder)
        .join()
        .timeout(const Duration(seconds: 25));
    Json result;
    try {
      result = object(jsonDecode(text));
    } catch (_) {
      throw ApiError(
        response.statusCode,
        'Server javobi olinmadi. Qayta urinib ko‘ring.',
      );
    }
    if (response.statusCode >= 300 || result['success'] == false) {
      final error = result['error'];
      throw ApiError(
        response.statusCode,
        error is Map
            ? '${error['message'] ?? 'Amal bajarilmadi'}'
            : '${error ?? 'Amal bajarilmadi'}',
      );
    }
    for (final c in response.cookies) {
      if (c.name == 'savdoza_auth_token') {
        cookie = c.value.isEmpty ? null : '${c.name}=${c.value}';
      }
    }
    return result;
  }

  Future<List<int>> bytes(String path) async {
    final request = await client.getUrl(Uri.parse('$serverUrl$path'));
    request.followRedirects = false;
    if (cookie != null) request.headers.set('Cookie', cookie!);
    final response = await request.close().timeout(const Duration(seconds: 25));
    if (response.statusCode != 200) {
      throw ApiError(response.statusCode, 'Faylni yuklab bo‘lmadi');
    }
    return response.fold<List<int>>([], (all, bytes) => all..addAll(bytes));
  }
}

class DeviceStore {
  final Json _memory = {'caches': <String, dynamic>{}, 'outbox': <dynamic>[]};
  Future<Json> read() async {
    if (!Platform.isAndroid) return object(jsonDecode(jsonEncode(_memory)));
    return object(
      jsonDecode(await device.invokeMethod<String>('readStore') ?? '{}'),
    );
  }

  Future<void> mutate(String action, [Json values = const {}]) async {
    if (Platform.isAndroid) {
      await device.invokeMethod('store', {'action': action, ...values});
      return;
    }
    switch (action) {
      case 'session':
        _memory['session'] = values['session'];
      case 'cache':
        (_memory['caches'] as Map)[values['scope']] = values['cache'];
      case 'enqueue':
        final orders = _memory['outbox'] as List;
        if (!orders.any((order) => order['key'] == values['order']['key']))
          orders.add(values['order']);
      case 'retry':
        for (final item in _memory['outbox']) {
          if (item['key'] == values['key']) item['status'] = 'pending';
        }
    }
  }

  Future<void> sync() async {
    if (Platform.isAndroid) await device.invokeMethod('sync');
  }
}

class AppData extends ChangeNotifier {
  AppData({Api? api, DeviceStore? store})
    : api = api ?? Api(),
      store = store ?? DeviceStore();
  final Api api;
  final DeviceStore store;
  Json? session;
  Json cache = {};
  List<Json> outbox = [];
  bool online = false, refreshing = false;
  String? connectionError;
  String get scope => '${session?['scope'] ?? ''}';
  Json get account => object(session?['account']);
  Json get user => object(account['user']);
  bool get max =>
      ['MAX', 'LEGACY'].contains(user['planCode']) ||
      user['role'] == 'SUPER_ADMIN';
  bool get owner => user['role'] == 'SHOP_ADMIN';
  bool get sell => ['SHOP_ADMIN', 'CASHIER'].contains(user['role']);
  bool get access {
    if (user['role'] == 'SUPER_ADMIN') return true;
    if (user['hasAccess'] != true) return false;
    final shop = object(account['shop']);
    final deadline = user['shopStatus'] == 'TRIAL'
        ? shop['trialEndDate']
        : user['subscriptionEndDate'];
    final end = DateTime.tryParse('${deadline ?? ''}');
    if (!cookieValid) return false;
    if (user['planCode'] == 'LEGACY' && end == null) return true;
    return end != null && end.isAfter(DateTime.now());
  }

  bool get cookieValid {
    try {
      final token = api.cookie!.split('=').last;
      final payload = object(
        jsonDecode(
          utf8.decode(
            base64Url.decode(base64Url.normalize(token.split('.')[1])),
          ),
        ),
      );
      return (payload['exp'] as num) * 1000 >
          DateTime.now().millisecondsSinceEpoch;
    } catch (_) {
      return false;
    }
  }

  List<Json> get orders =>
      outbox.where((order) => order['scope'] == scope).toList();
  List<Json> get pending =>
      orders.where((order) => order['status'] != 'synced').toList();
  List<Json> get products {
    final result = records(jsonDecode(jsonEncode(cache['products'] ?? [])));
    final fetched = DateTime.tryParse('${cache['productsFetchedAt'] ?? ''}');
    for (final order in orders) {
      final synced = DateTime.tryParse('${order['syncedAt'] ?? ''}');
      if (order['status'] == 'synced' &&
          synced != null &&
          fetched != null &&
          fetched.isAfter(synced)) {
        continue;
      }
      for (final item in records(object(order['payload'])['items'])) {
        for (final product in result.where(
          (p) => p['id'] == item['productId'],
        )) {
          final batches = product['batches'] as List;
          for (final raw in batches) {
            if (raw['id'] == item['batchId']) {
              raw['currentQuantity'] =
                  ((raw['currentQuantity'] as num) - (item['quantity'] as num))
                      .clamp(0, double.infinity);
            }
          }
        }
      }
    }
    for (final product in result) {
      product['totalStock'] = records(
        product['batches'],
      ).fold<num>(0, (sum, batch) => sum + (batch['currentQuantity'] as num));
    }
    return result;
  }

  Future<void> restore() async {
    await reload();
    api.cookie = session?['cookie'] as String?;
    if (session != null) {
      await refresh();
    }
  }

  Future<void> reload() async {
    final root = await store.read();
    session = root['session'] == null ? null : object(root['session']);
    cache = object(object(root['caches'])[scope]);
    outbox = records(root['outbox']);
    notifyListeners();
  }

  Future<void> persist() async {
    if (session == null) return;
    session!['cookie'] = api.cookie;
    await store.mutate('session', {'session': session});
    await store.mutate('cache', {'scope': scope, 'cache': cache});
  }

  Future<void> login(String username, String password) async {
    api.cookie = null;
    final result = await api.call(
      '/api/auth/login',
      method: 'POST',
      body: {'username': username.trim(), 'password': password},
    );
    final user = object(result['user']);
    session = {
      'cookie': api.cookie,
      'scope': '$serverUrl|${user['id']}|${user['shopId']}',
      'server': serverUrl,
      'userId': user['id'],
      'shopId': user['shopId'],
      'account': {'user': user},
    };
    await store.mutate('session', {'session': session});
    await reload();
    await refresh();
  }

  Future<void> registered(Json body) async {
    await api.call('/api/auth/register', method: 'POST', body: body);
    final result = await api.call('/api/account');
    final account = object(result['data']);
    final user = object(account['user']);
    session = {
      'cookie': api.cookie,
      'scope': '$serverUrl|${user['id']}|${user['shopId']}',
      'server': serverUrl,
      'userId': user['id'],
      'shopId': user['shopId'],
      'account': account,
    };
    await persist();
    await refresh();
  }

  Future<void> refresh() async {
    if (session == null || refreshing) return;
    refreshing = true;
    final originalScope = scope;
    try {
      final accountResult = await api.call('/api/account');
      if (session == null || scope != originalScope) return;
      session!['account'] = object(accountResult['data']);
      online = true;
      connectionError = null;
      await persist();
      if (access && user['role'] != 'SUPER_ADMIN') {
        final started = DateTime.now().toUtc().toIso8601String();
        final results = await Future.wait([
          api.call('/api/products'),
          api.call('/api/categories'),
          api.call('/api/customers'),
          api.call('/api/shop/settings'),
          api.call('/api/reports'),
          api.call('/api/manufacturers'),
        ]);
        if (session == null || scope != originalScope) return;
        cache.addAll({
          'products': results[0]['data'],
          'categories': results[1]['data'],
          'customers': results[2]['data'],
          'shopSettings': results[3]['data'],
          'reports': results[4]['data'],
          'manufacturers': results[5]['data'],
          'productsFetchedAt': started,
        });
        await persist();
      }
      await store.sync();
    } on ApiError catch (error) {
      connectionError = error.message;
      if (error.status == 401) {
        online = true;
        api.cookie = null;
        if (session != null) session!['cookie'] = null;
        await persist();
      } else {
        online = false;
      }
    } catch (_) {
      online = false;
      connectionError = 'Offline rejim. Saqlangan ma’lumotlar ko‘rsatilmoqda.';
    } finally {
      refreshing = false;
      await reload();
    }
  }

  Future<dynamic> get(String path, {String? cacheKey}) async {
    final originalScope = scope;
    try {
      final result = await api.call(path);
      if (scope != originalScope) {
        throw StateError('Hisob almashgan. Sahifani qayta oching.');
      }
      online = true;
      if (cacheKey != null) {
        cache[cacheKey] = result['data'];
        await persist();
      }
      return result['data'];
    } catch (_) {
      if (cacheKey != null && cache.containsKey(cacheKey)) {
        return cache[cacheKey];
      }
      rethrow;
    }
  }

  Future<void> enqueue(Json payload, Json receipt, {bool debt = false}) async {
    if (!access || !sell || !cookieValid) {
      throw ApiError(
        403,
        'Faol tarif va sessiya kerak. Internetga ulanib hisobni yangilang.',
      );
    }
    final key = saleKey();
    final entry = {
      'key': key,
      'scope': scope,
      'server': serverUrl,
      'shopId': user['shopId'],
      'userId': user['id'],
      'status': 'pending',
      'createdAt': DateTime.now().toUtc().toIso8601String(),
      'path': debt ? '/api/debts/sale' : '/api/sales',
      'payload': {
        ...payload,
        'idempotencyKey': key,
        'occurredAt': receipt['createdAt'],
      },
      'receipt': {
        ...receipt,
        'receiptNumber': key,
        'offlineUrl': '$serverUrl/chek/offline/$key',
      },
    };
    await store.mutate('enqueue', {'order': entry});
    await reload();
    await store.sync();
  }

  Future<void> logout() async {
    try {
      await api.call('/api/auth/logout', method: 'POST', body: {});
    } catch (_) {
      /* Local logout still removes the session. */
    }
    api.cookie = null;
    session = null;
    cache = {};
    await store.mutate('session', {'session': null});
    await reload();
  }
}
