import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import 'data.dart';
import 'widgets.dart';

class GuidePage extends StatefulWidget {
  const GuidePage({super.key, required this.data});
  final AppData data;

  @override
  State<GuidePage> createState() => _GuidePageState();
}

class _GuidePageState extends State<GuidePage> {
  List<Json> lessons = [];
  bool loading = true;
  String query = '';
  String category = '';
  String language = 'uz';
  String? selectedId;
  String? error;

  @override
  void initState() {
    super.initState();
    load();
  }

  Future<void> load() async {
    setState(() => loading = true);
    try {
      final result = records(
        await widget.data.get('/api/guide-videos', cacheKey: 'guideVideos'),
      );
      if (mounted)
        setState(() {
          lessons = result;
          error = null;
          selectedId ??= result.firstOrNull?['id'] as String?;
        });
    } catch (cause) {
      if (mounted) setState(() => error = '$cause');
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  String localized(dynamic value) =>
      '${object(value)[language] ?? object(value)['uz'] ?? ''}';

  Future<void> play(Json lesson) async {
    final source = '${lesson['sourceUrl'] ?? ''}';
    final uri = Uri.tryParse(
      source.startsWith('/') ? '$serverUrl$source' : source,
    );
    if (uri == null || uri.scheme != 'https') {
      await message(context, 'Video manzili noto‘g‘ri');
      return;
    }
    final start = (lesson['startSeconds'] as num?)?.floor() ?? 0;
    final video = source.contains('youtu')
        ? uri.replace(queryParameters: {...uri.queryParameters, 't': '$start'})
        : uri.replace(fragment: 't=$start');
    if (!await launchUrl(video, mode: LaunchMode.externalApplication) &&
        mounted) {
      await message(context, 'Videoni ochib bo‘lmadi');
    }
  }

  @override
  Widget build(BuildContext context) {
    final categories = lessons
        .map((lesson) => '${lesson['category']}')
        .toSet()
        .toList();
    final visible = lessons
        .where(
          (lesson) =>
              (category.isEmpty || lesson['category'] == category) &&
              (query.isEmpty ||
                  localized(
                    lesson['title'],
                  ).toLowerCase().contains(query.toLowerCase()) ||
                  localized(
                    lesson['description'],
                  ).toLowerCase().contains(query.toLowerCase())),
        )
        .toList();
    final selected = lessons
        .where((lesson) => lesson['id'] == selectedId)
        .firstOrNull;
    return RefreshIndicator(
      onRefresh: load,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Row(
            children: [
              const Expanded(
                child: Text(
                  'Video qo‘llanma',
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                ),
              ),
              SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'uz', label: Text('UZ')),
                  ButtonSegment(value: 'en', label: Text('EN')),
                ],
                selected: {language},
                onSelectionChanged: (value) =>
                    setState(() => language = value.first),
              ),
            ],
          ),
          if (error != null)
            Text(error!, style: const TextStyle(color: Colors.red)),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              SizedBox(
                width: 300,
                child: TextField(
                  decoration: const InputDecoration(
                    labelText: 'Darsni qidirish',
                    prefixIcon: Icon(Icons.search),
                  ),
                  onChanged: (value) => setState(() => query = value),
                ),
              ),
              DropdownButton<String>(
                value: category,
                items: [
                  const DropdownMenuItem(
                    value: '',
                    child: Text('Barcha mavzular'),
                  ),
                  ...categories.map(
                    (item) => DropdownMenuItem(value: item, child: Text(item)),
                  ),
                ],
                onChanged: (value) => setState(() => category = value ?? ''),
              ),
              IconButton(
                onPressed: loading ? null : load,
                tooltip: 'Yangilash',
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (!loading && visible.isEmpty) const Text('Dars topilmadi.'),
          for (final lesson in visible)
            Card(
              child: ListTile(
                selected: lesson['id'] == selectedId,
                leading: const Icon(Icons.play_circle_outline),
                title: Text(localized(lesson['title'])),
                subtitle: Text(localized(lesson['description'])),
                trailing: Text(
                  '${(((lesson['endSeconds'] as num?) ?? 0) - ((lesson['startSeconds'] as num?) ?? 0)).round()} soniya',
                ),
                onTap: () => setState(() => selectedId = '${lesson['id']}'),
              ),
            ),
          if (selected != null)
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      localized(selected['title']),
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    const SizedBox(height: 10),
                    FilledButton.icon(
                      onPressed: () => play(selected),
                      icon: const Icon(Icons.play_arrow),
                      label: const Text('Videoni ochish'),
                    ),
                    const SizedBox(height: 12),
                    for (final (index, step)
                        in (object(selected['steps'])[language] as List? ?? [])
                            .indexed)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 6),
                        child: Text('${index + 1}. $step'),
                      ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }
}
