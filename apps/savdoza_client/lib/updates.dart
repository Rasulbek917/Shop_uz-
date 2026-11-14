import 'dart:convert';
import 'dart:io';

import 'package:flutter/material.dart';

import 'data.dart';

class AppRelease {
  AppRelease.fromJson(Json data, {String platform = 'android'})
    : version = '${data['version']}',
      sha256 = '${data['sha256']}',
      url = '${data['url']}',
      bytes = (data['bytes'] as num).toInt(),
      build = int.parse('${data['version']}'.split('+').last) {
    final uri = Uri.parse(url);
    final path = platform == 'android'
        ? '/Rasulbek917/Shop_uz-/releases/download/android-latest/savdoza-android.apk'
        : '/Rasulbek917/Shop_uz-/releases/download/windows-latest/savdoza-windows-setup.exe';
    if (build <= 0 ||
        bytes <= 0 ||
        bytes > 209715200 ||
        !RegExp(r'^[a-fA-F0-9]{64}$').hasMatch(sha256) ||
        uri.scheme != 'https' ||
        uri.host != 'github.com' ||
        uri.userInfo.isNotEmpty ||
        !['android', 'windows'].contains(platform) ||
        uri.path != path) {
      throw const FormatException('Yangilanish ma’lumotlari noto‘g‘ri');
    }
  }
  final String version, sha256, url;
  final int bytes, build;
}

final appUpdates = AppUpdates();

class AppUpdates extends ChangeNotifier {
  AppRelease? release;
  String version = '', error = '';
  int build = 0;
  bool checking = false,
      downloading = false,
      ready = false,
      needsPermission = false;
  DateTime? lastChecked;
  bool get available => release != null && release!.build > build;

  Future<void> check({bool force = false}) async {
    if ((!Platform.isAndroid && !Platform.isWindows) || checking || downloading)
      return;
    if (!force &&
        lastChecked != null &&
        DateTime.now().difference(lastChecked!) < const Duration(hours: 6)) {
      return;
    }
    checking = true;
    error = '';
    notifyListeners();
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 12);
    try {
      final current = object(await device.invokeMethod('appVersion'));
      version = '${current['version']}+${current['build']}';
      build = (current['build'] as num).toInt();
      final request = await client.getUrl(
        Uri.parse(
          '$serverUrl/releases/manifest.json?t=${DateTime.now().millisecondsSinceEpoch}',
        ),
      );
      request.followRedirects = false;
      final response = await request.close().timeout(
        const Duration(seconds: 20),
      );
      if (response.statusCode != 200) {
        throw const HttpException('Yangilanishni tekshirib bo‘lmadi');
      }
      final text = await response
          .transform(utf8.decoder)
          .join()
          .timeout(const Duration(seconds: 20));
      final next = AppRelease.fromJson(
        object(
          object(jsonDecode(text))[Platform.isWindows ? 'windows' : 'android'],
        ),
        platform: Platform.isWindows ? 'windows' : 'android',
      );
      if (next.build != release?.build) {
        ready = false;
        needsPermission = false;
      }
      release = next;
      lastChecked = DateTime.now();
    } catch (_) {
      error = 'Yangilanishni tekshirib bo‘lmadi. Internetni tekshirib, qayta urinib ko‘ring.';
    } finally {
      client.close(force: true);
      checking = false;
      notifyListeners();
    }
  }

  Future<void> _downloadWindows(AppRelease target) async {
    final base = Platform.environment['LOCALAPPDATA'];
    if (base == null)
      throw const FileSystemException('Yangilanish papkasi topilmadi');
    final directory = Directory('$base/Savdoza/updates');
    await directory.create(recursive: true);
    final partial = File('${directory.path}/download.part');
    final destination = File('${directory.path}/savdoza-windows-setup.exe');
    final client = HttpClient()
      ..connectionTimeout = const Duration(seconds: 15);
    var uri = Uri.parse(
      '${target.url}?v=${Uri.encodeComponent(target.version)}',
    );
    try {
      for (var redirects = 0; redirects < 6; redirects++) {
        if (uri.scheme != 'https' ||
            uri.userInfo.isNotEmpty ||
            ![
              'github.com',
              'release-assets.githubusercontent.com',
              'objects.githubusercontent.com',
            ].contains(uri.host))
          throw const HttpException('Yuklab olish manzili tasdiqlanmadi');
        final request = await client.getUrl(uri);
        request.followRedirects = false;
        final response = await request.close().timeout(
          const Duration(seconds: 30),
        );
        if ([301, 302, 303, 307, 308].contains(response.statusCode)) {
          final location = response.headers.value('location');
          if (location == null)
            throw const HttpException('Yangilanish havolasi olinmadi');
          uri = uri.resolve(location);
          await response.drain<void>().timeout(const Duration(seconds: 15));
          continue;
        }
        if (response.statusCode != 200)
          throw const HttpException('Yangilanish yuklanmadi');
        final sink = partial.openWrite();
        var count = 0;
        final deadline = DateTime.now().add(const Duration(minutes: 15));
        try {
          await for (final chunk in response.timeout(
            const Duration(seconds: 45),
          )) {
            count += chunk.length;
            if (count > target.bytes || DateTime.now().isAfter(deadline))
              throw const HttpException(
                'Yuklab olish hajmi yoki vaqti noto‘g‘ri',
              );
            sink.add(chunk);
          }
          await sink.flush();
        } finally {
          await sink.close();
        }
        if (count != target.bytes)
          throw const HttpException('Fayl to‘liq yuklanmadi');
        if (await destination.exists()) await destination.delete();
        await partial.rename(destination.path);
        await device.invokeMethod('verifyUpdate', {
          'sha256': target.sha256,
          'bytes': target.bytes,
        });
        return;
      }
      throw const HttpException('Yuklab olish havolalari chegaradan oshdi');
    } finally {
      client.close(force: true);
      if (await partial.exists()) await partial.delete();
    }
  }

  Future<void> update() async {
    if (!available || downloading) return;
    downloading = true;
    error = '';
    notifyListeners();
    final target = release!;
    try {
      if (!ready) {
        if (Platform.isWindows) {
          await _downloadWindows(target);
        } else {
          await device.invokeMethod('downloadUpdate', {
            'url': '${target.url}?v=${Uri.encodeComponent(target.version)}',
            'sha256': target.sha256,
            'bytes': target.bytes,
            'build': target.build,
          });
        }
        ready = true;
      }
      final result = await device.invokeMethod<String>('installUpdate', {
        'build': target.build,
        'sha256': target.sha256,
        'bytes': target.bytes,
      });
      needsPermission = result == 'permission';
    } catch (e) {
      error = 'Yangilanish bajarilmadi. ${e.toString()}';
      ready = false;
    } finally {
      downloading = false;
      notifyListeners();
    }
  }
}

void openUpdates(BuildContext context) => Navigator.push<void>(
  context,
  MaterialPageRoute(builder: (_) => const UpdatesPage()),
);

class UpdatesPage extends StatefulWidget {
  const UpdatesPage({super.key});
  @override
  State<UpdatesPage> createState() => _UpdatesPageState();
}

class _UpdatesPageState extends State<UpdatesPage> {
  @override
  void initState() {
    super.initState();
    appUpdates.check(force: true);
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Ilovani yangilash')),
    body: ListenableBuilder(
      listenable: appUpdates,
      builder: (context, _) => ListView(
        padding: const EdgeInsets.all(20),
        children: [
          const Icon(Icons.system_update, size: 52, color: Color(0xff24634f)),
          const SizedBox(height: 20),
          Text(
            'O‘rnatilgan versiya ${appUpdates.version}',
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 20),
          if (appUpdates.checking) const LinearProgressIndicator(),
          if (appUpdates.error.isNotEmpty)
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                appUpdates.error,
                style: const TextStyle(color: Colors.red),
              ),
            ),
          if (appUpdates.available) ...[
            Text(
              'Yangi versiya ${appUpdates.release!.version}',
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold),
            ),
            const SizedBox(height: 8),
            Text(
              '${(appUpdates.release!.bytes / 1048576).toStringAsFixed(1)} MB',
            ),
            const SizedBox(height: 16),
            if (appUpdates.needsPermission)
              const Padding(
                padding: EdgeInsets.only(bottom: 16),
                child: Text(
                  'Android sozlamalarida Savdoza uchun ilova o‘rnatish ruxsatini yoqing, so‘ng shu yerga qaytib “O‘rnatish”ni bosing.',
                ),
              ),
            if (appUpdates.downloading) const LinearProgressIndicator(),
            FilledButton.icon(
              onPressed: appUpdates.downloading ? null : appUpdates.update,
              icon: const Icon(Icons.download),
              label: Text(
                appUpdates.downloading
                    ? 'Yuklanmoqda…'
                    : appUpdates.ready
                    ? 'O‘rnatish'
                    : 'Yangilanishni yuklash',
              ),
            ),
          ] else if (!appUpdates.checking && appUpdates.error.isEmpty)
            const Text(
              'Ilovangiz oxirgi versiyada.',
              textAlign: TextAlign.center,
            ),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: appUpdates.checking || appUpdates.downloading
                ? null
                : () => appUpdates.check(force: true),
            icon: const Icon(Icons.refresh),
            label: const Text('Yangilanishni tekshirish'),
          ),
        ],
      ),
    ),
  );
}
