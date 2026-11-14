import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import 'data.dart';
import 'dashboard.dart';
import 'updates.dart';
import 'navigation.dart';

class DesktopShell extends StatefulWidget {
  const DesktopShell({
    super.key,
    required this.data,
    required this.destinations,
    required this.section,
    required this.onNavigate,
    required this.onLogout,
    required this.child,
  });
  final AppData data;
  final List<Destination> destinations;
  final String section;
  final ValueChanged<String> onNavigate;
  final VoidCallback onLogout;
  final Widget child;

  @override
  State<DesktopShell> createState() => _DesktopShellState();
}

class _DesktopShellState extends State<DesktopShell> {
  final navigationScroll = ScrollController();
  bool? collapsed;
  bool focusMode = false;
  bool get navigationCollapsed =>
      collapsed ?? MediaQuery.sizeOf(context).width < 1050;
  String search = '';

  @override
  void dispose() {
    navigationScroll.dispose();
    super.dispose();
  }

  bool enabled(Destination item) =>
      (!item.max || widget.data.max) &&
      (widget.data.access || ['settings', 'queue'].contains(item.key));

  void navigate(String key) {
    final destination = widget.destinations
        .where((item) => item.key == key)
        .firstOrNull;
    if (destination != null && enabled(destination)) widget.onNavigate(key);
  }

  Widget menu(String title, List<String> keys) {
    final items = widget.destinations
        .where((item) => keys.contains(item.key))
        .toList();
    if (items.isEmpty) return const SizedBox.shrink();
    return SubmenuButton(
      menuChildren: [
        for (final destination in items)
          MenuItemButton(
            onPressed: enabled(destination)
                ? () => navigate(destination.key)
                : null,
            leadingIcon: Icon(destination.icon, size: 18),
            trailingIcon: destination.max && !widget.data.max
                ? const Icon(Icons.lock_outline, size: 14)
                : null,
            child: Text(destination.title),
          ),
      ],
      child: Text(title),
    );
  }

  @override
  Widget build(BuildContext context) {
    final selected = widget.destinations.firstWhere(
      (item) => item.key == widget.section,
    );
    final visible = widget.destinations
        .where(
          (item) => item.title.toLowerCase().contains(search.toLowerCase()),
        )
        .toList();
    return CallbackShortcuts(
      bindings: {
        const SingleActivator(LogicalKeyboardKey.digit1, control: true): () =>
            navigate('dashboard'),
        const SingleActivator(LogicalKeyboardKey.digit2, control: true): () =>
            navigate('pos'),
        const SingleActivator(LogicalKeyboardKey.keyR, control: true):
            widget.data.refresh,
        const SingleActivator(LogicalKeyboardKey.f11): () =>
            setState(() => focusMode = !focusMode),
        const SingleActivator(LogicalKeyboardKey.escape): () {
          if (focusMode) setState(() => focusMode = false);
        },
      },
      child: Focus(
        autofocus: true,
        child: Theme(
          data: Theme.of(context).copyWith(
            visualDensity: VisualDensity.standard,
            cardTheme: CardThemeData(
              color: Colors.white,
              surfaceTintColor: Colors.transparent,
              elevation: 0,
              margin: EdgeInsets.zero,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
                side: const BorderSide(color: Color(0xffdbe3e7)),
              ),
            ),
            filledButtonTheme: FilledButtonThemeData(
              style: FilledButton.styleFrom(
                minimumSize: const Size(100, 44),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            outlinedButtonTheme: OutlinedButtonThemeData(
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(100, 44),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            scaffoldBackgroundColor: const Color(0xffedf1f4),
            inputDecorationTheme: Theme.of(context).inputDecorationTheme
                .copyWith(isDense: true),
          ),
          child: Scaffold(
            body: LayoutBuilder(
              builder: (context, constraints) {
                final compact = navigationCollapsed;
                return Column(
                  children: [
                    if (!focusMode)
                      Material(
                        color: Colors.white,
                        child: Row(
                          children: [
                            const Padding(
                              padding: EdgeInsets.symmetric(horizontal: 16),
                              child: Icon(
                                Icons.desktop_windows_outlined,
                                color: Color(0xff24634f),
                                size: 22,
                              ),
                            ),
                            Expanded(
                              child: SingleChildScrollView(
                                scrollDirection: Axis.horizontal,
                                child: MenuBar(
                                  style: const MenuStyle(
                                    elevation: WidgetStatePropertyAll(0),
                                    backgroundColor: WidgetStatePropertyAll(
                                      Colors.white,
                                    ),
                                  ),
                                  children: [
                                    menu('Ish stoli', [
                                      'dashboard',
                                      'shops',
                                      'requests',
                                      'pricing',
                                    ]),
                                    menu('Savdo', [
                                      'pos',
                                      'receipts',
                                      'returns',
                                      'debts',
                                    ]),
                                    menu('Ma’lumotlar', [
                                      'products',
                                      'categories',
                                      'batches',
                                      'customers',
                                      'manufacturers',
                                      'suppliers',
                                    ]),
                                    menu('Boshqaruv', [
                                      'reports',
                                      'staff',
                                      'audit',
                                      'notifications',
                                      'settings',
                                    ]),
                                    SubmenuButton(
                                      menuChildren: [
                                        MenuItemButton(
                                          onPressed: () => setState(
                                            () => collapsed =
                                                !navigationCollapsed,
                                          ),
                                          child: const Text(
                                            'Yon menyuni yig‘ish / ochish',
                                          ),
                                        ),
                                        MenuItemButton(
                                          onPressed: () =>
                                              setState(() => focusMode = true),
                                          child: const Text(
                                            'Ish maydonini kengaytirish · F11',
                                          ),
                                        ),
                                      ],
                                      child: const Text('Ko‘rinish'),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            IconButton(
                              tooltip: appUpdates.available
                                  ? 'Yangi versiya mavjud'
                                  : 'Ilovani yangilash',
                              onPressed: () => openUpdates(context),
                              icon: Icon(
                                Icons.system_update_alt,
                                color: appUpdates.available
                                    ? const Color(0xff24634f)
                                    : null,
                              ),
                            ),
                            IconButton(
                              tooltip: 'Yangilash · Ctrl+R',
                              onPressed: widget.data.refreshing
                                  ? null
                                  : widget.data.refresh,
                              icon: const Icon(Icons.refresh, size: 20),
                            ),
                            IconButton(
                              tooltip: 'Hisobdan chiqish',
                              onPressed: widget.onLogout,
                              icon: const Icon(Icons.logout, size: 20),
                            ),
                          ],
                        ),
                      ),
                    if (widget.data.refreshing)
                      const LinearProgressIndicator(minHeight: 2),
                    Expanded(
                      child: Row(
                        children: [
                          if (!focusMode)
                            AnimatedContainer(
                              duration: const Duration(milliseconds: 180),
                              width: compact ? 76 : 244,
                              color: const Color(0xff142d25),
                              child: Column(
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 10,
                                      vertical: 14,
                                    ),
                                    child: Row(
                                      children: [
                                        IconButton(
                                          tooltip: 'Menyuni yig‘ish / ochish',
                                          onPressed: () => setState(
                                            () => collapsed =
                                                !navigationCollapsed,
                                          ),
                                          icon: const Icon(
                                            Icons.menu_open,
                                            color: Colors.white,
                                          ),
                                        ),
                                        if (!compact)
                                          const Expanded(
                                            child: Text(
                                              'SAVDOZA',
                                              style: TextStyle(
                                                color: Colors.white,
                                                fontWeight: FontWeight.w800,
                                                fontSize: 20,
                                              ),
                                            ),
                                          ),
                                      ],
                                    ),
                                  ),
                                  if (!compact)
                                    Padding(
                                      padding: const EdgeInsets.fromLTRB(
                                        12,
                                        0,
                                        12,
                                        12,
                                      ),
                                      child: TextField(
                                        style: const TextStyle(
                                          color: Colors.white,
                                          fontSize: 13,
                                        ),
                                        decoration: const InputDecoration(
                                          hintText: 'Bo‘lim qidirish',
                                          hintStyle: TextStyle(
                                            color: Colors.white60,
                                          ),
                                          prefixIcon: Icon(
                                            Icons.search,
                                            color: Colors.white60,
                                            size: 18,
                                          ),
                                          filled: true,
                                          fillColor: Color(0xff244238),
                                        ),
                                        onChanged: (value) =>
                                            setState(() => search = value),
                                      ),
                                    ),
                                  Expanded(
                                    child: Scrollbar(
                                      controller: navigationScroll,
                                      thumbVisibility: true,
                                      child: ListView.builder(
                                        key: const PageStorageKey(
                                          'desktop-navigation',
                                        ),
                                        controller: navigationScroll,
                                        padding: const EdgeInsets.symmetric(
                                          horizontal: 8,
                                          vertical: 4,
                                        ),
                                        itemCount: visible.length,
                                        itemBuilder: (context, index) {
                                          final item = visible[index];
                                          return Padding(
                                            padding: const EdgeInsets.only(
                                              bottom: 4,
                                            ),
                                            child: Tooltip(
                                              message:
                                                  item.max && !widget.data.max
                                                  ? '${item.title} · Max tarifiga o‘ting'
                                                  : item.title,
                                              child: Theme(
                                                data: Theme.of(context)
                                                    .copyWith(
                                                      disabledColor:
                                                          Colors.white38,
                                                    ),
                                                child: Material(
                                                  type:
                                                      MaterialType.transparency,
                                                  child: ListTile(
                                                    dense: true,
                                                    selected:
                                                        item.key ==
                                                        widget.section,
                                                    enabled: enabled(item),
                                                    shape: RoundedRectangleBorder(
                                                      borderRadius:
                                                          BorderRadius.circular(
                                                            8,
                                                          ),
                                                    ),
                                                    selectedTileColor:
                                                        const Color(0xff31664f),
                                                    selectedColor: Colors.white,
                                                    textColor: Colors.white70,
                                                    iconColor: Colors.white70,
                                                    contentPadding:
                                                        const EdgeInsets.symmetric(
                                                          horizontal: 14,
                                                        ),
                                                    leading: Icon(
                                                      item.icon,
                                                      size: 20,
                                                    ),
                                                    title: compact
                                                        ? null
                                                        : Text(
                                                            item.title,
                                                            maxLines: 1,
                                                            overflow:
                                                                TextOverflow
                                                                    .ellipsis,
                                                            style:
                                                                const TextStyle(
                                                                  fontSize: 13,
                                                                ),
                                                          ),
                                                    trailing:
                                                        !compact &&
                                                            item.max &&
                                                            !widget.data.max
                                                        ? const Icon(
                                                            Icons.lock_outline,
                                                            size: 15,
                                                            color:
                                                                Colors.white38,
                                                          )
                                                        : null,
                                                    onTap: () =>
                                                        navigate(item.key),
                                                  ),
                                                ),
                                              ),
                                            ),
                                          );
                                        },
                                      ),
                                    ),
                                  ),
                                  if (!compact)
                                    Padding(
                                      padding: const EdgeInsets.all(16),
                                      child: Text(
                                        '${widget.data.user['username']} · ${widget.data.user['planCode']}',
                                        style: const TextStyle(
                                          color: Colors.white60,
                                          fontSize: 12,
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                            ),
                          Expanded(
                            child: Column(
                              children: [
                                Padding(
                                  padding: const EdgeInsets.fromLTRB(
                                    20,
                                    10,
                                    16,
                                    10,
                                  ),
                                  child: Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          selected.title,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w700,
                                            fontSize: 20,
                                          ),
                                        ),
                                      ),
                                      if (focusMode)
                                        TextButton.icon(
                                          onPressed: () =>
                                              setState(() => focusMode = false),
                                          icon: const Icon(
                                            Icons.fullscreen_exit,
                                          ),
                                          label: const Text(
                                            'Menyuga qaytish · F11',
                                          ),
                                        ),
                                      if (!focusMode)
                                        Flexible(
                                          child: Text(
                                            '${widget.data.user['shopName'] ?? widget.data.user['fullName']}',
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              color: Colors.blueGrey,
                                              fontSize: 13,
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                                Expanded(
                                  child: Container(
                                    margin: const EdgeInsets.fromLTRB(
                                      16,
                                      0,
                                      16,
                                      12,
                                    ),
                                    clipBehavior: Clip.antiAlias,
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      border: Border.all(
                                        color: const Color(0xffdbe3e7),
                                      ),
                                      borderRadius: BorderRadius.circular(10),
                                    ),
                                    child: Material(
                                      color: Colors.white,
                                      child: widget.child,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    ColoredBox(
                      color: Colors.white,
                      child: Padding(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 16,
                          vertical: 6,
                        ),
                        child: Row(
                          children: [
                            Icon(
                              widget.data.online
                                  ? Icons.cloud_done_outlined
                                  : Icons.cloud_off_outlined,
                              size: 15,
                              color: const Color(0xff24634f),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                '${widget.data.online ? 'Online' : 'Offline'} · ${widget.data.pending.length} ta yuborilmagan savdo',
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: const TextStyle(fontSize: 11),
                              ),
                            ),
                            if (widget.destinations.any(
                              (item) => item.key == 'queue',
                            ))
                              TextButton(
                                onPressed: () => navigate('queue'),
                                child: const Text(
                                  'Sinxronlash',
                                  style: TextStyle(fontSize: 11),
                                ),
                              ),
                          ],
                        ),
                      ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      ),
    );
  }
}

class DesktopAuthFrame extends StatelessWidget {
  const DesktopAuthFrame({super.key, required this.child});
  final Widget child;

  @override
  Widget build(BuildContext context) => LayoutBuilder(
    builder: (context, constraints) {
      if (!Platform.isWindows || constraints.maxWidth < 950) return child;
      return Row(
        children: [
          Expanded(
            child: ColoredBox(
              color: const Color(0xff142d25),
              child: Padding(
                padding: const EdgeInsets.all(56),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.desktop_windows_outlined,
                      color: Color(0xffb8d9c5),
                      size: 64,
                    ),
                    const SizedBox(height: 32),
                    const Text(
                      'Savdoza\nWindows',
                      style: TextStyle(
                        fontSize: 48,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                        height: 1.15,
                      ),
                    ),
                    const SizedBox(height: 24),
                    const Text(
                      'Savdo, ombor va hisobotlar uchun ish maydoni.',
                      style: TextStyle(fontSize: 20, color: Colors.white70),
                    ),
                    const SizedBox(height: 32),
                    for (final label in [
                      'USB skaner bilan savdo',
                      'Printerdan chek chiqarish',
                      'Internet qaytganda sinxronlash',
                    ])
                      Padding(
                        padding: const EdgeInsets.only(bottom: 16),
                        child: Text(
                          label,
                          style: const TextStyle(
                            color: Colors.white70,
                            fontSize: 15,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          ),
          Expanded(child: child),
        ],
      );
    },
  );
}

class DesktopDashboard extends StatelessWidget {
  const DesktopDashboard({
    super.key,
    required this.data,
    required this.onNavigate,
  });
  final AppData data;
  final ValueChanged<String> onNavigate;
  @override
  Widget build(BuildContext context) =>
      DashboardPage(data: data, onNavigate: onNavigate);
}
