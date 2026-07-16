import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Pressable,
  TextInput,
  FlatList,
  Platform,
  Modal,
} from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

import { colors, radii } from '../../theme/colors';

const FONT = Platform.select({ ios: 'System', android: 'sans-serif' });

export type DropdownCategory = {
  category_id: string;
  category_name: string;
};

interface CategoryDropdownProps {
  label: string;
  categories: DropdownCategory[];
  activeCategoryId: string | null;
  activeCategoryName: string;
  onSelect: (categoryId: string, categoryName: string) => void;
  accent?: string;
  icon?: string;
  searchPlaceholder?: string;
  onSearchToggle?: () => void;
  searchActive?: boolean;
  onBack?: () => void;
}

// ─────────────────────────────────────────────────────────────
// Reusable Mirror category switcher — header trigger + searchable
// overlay panel. Used by Live TV (and, later, Movies / Series).
// ─────────────────────────────────────────────────────────────
export default function CategoryDropdown({
  label,
  categories,
  activeCategoryId,
  activeCategoryName,
  onSelect,
  accent = colors.magentaOnAir,
  icon = 'layer-group',
  searchPlaceholder = 'Search categories',
  onSearchToggle,
  searchActive = false,
  onBack,
}: CategoryDropdownProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [panelTop, setPanelTop] = useState(0);
  const headerRef = useRef<View>(null);

  useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  const safeCategories = useMemo(
    () => (Array.isArray(categories) ? categories : []),
    [categories],
  );

  const normalized = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      normalized
        ? safeCategories.filter(c =>
            c.category_name?.toLowerCase().includes(normalized),
          )
        : safeCategories,
    [normalized, safeCategories],
  );

  const toggleOpen = () => {
    if (open) {
      setOpen(false);
      return;
    }
    headerRef.current?.measureInWindow((_x, y, _w, h) => {
      setPanelTop(y + h + 2);
      setOpen(true);
    });
  };

  const handleSelect = (c: DropdownCategory) => {
    onSelect(c.category_id, c.category_name);
    setOpen(false);
  };

  return (
    <View style={styles.root}>
      {/* header row */}
      <View ref={headerRef} style={styles.headerRow} collapsable={false}>
        {onBack && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onBack}
            style={styles.backBtn}
          >
            <FontAwesome5 name="chevron-left" size={16} color={colors.fg} />
          </TouchableOpacity>
        )}
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={toggleOpen}
          style={[
            styles.trigger,
            open && {
              backgroundColor: 'rgba(255,255,255,0.06)',
              borderColor: colors.border,
            },
          ]}
        >
          <View
            style={[
              styles.triggerIcon,
              { backgroundColor: `${accent}26`, borderColor: `${accent}55` },
            ]}
          >
            <FontAwesome5 name={icon} size={16} color={accent} />
          </View>
          <View style={styles.triggerBody}>
            <Text style={[styles.eyebrow, { color: accent }]} numberOfLines={1}>
              {label}
            </Text>
            <View style={styles.triggerNameRow}>
              <Text style={styles.triggerName} numberOfLines={1}>
                {activeCategoryName || 'Select category'}
              </Text>
              <FontAwesome5
                name={open ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={colors.fgMuted}
                style={styles.chevron}
              />
            </View>
          </View>
        </TouchableOpacity>

        {onSearchToggle && (
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onSearchToggle}
            style={[
              styles.searchBtn,
              searchActive
                ? { backgroundColor: `${accent}26`, borderColor: `${accent}66` }
                : null,
            ]}
          >
            <FontAwesome5
              name="search"
              size={16}
              color={searchActive ? accent : colors.fgMuted}
            />
          </TouchableOpacity>
        )}
      </View>

      {/* overlay — rendered in a Modal so touches/scrolls on the panel
          don't fall through to the list behind it (Android drops touches
          on children that overflow their parent's bounds) */}
      <Modal
        visible={open}
        transparent
        animationType="none"
        statusBarTranslucent
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.scrim} onPress={() => setOpen(false)} />
        <View style={[styles.panel, { top: panelTop }]}>
          <View style={[styles.panelSearch, { borderColor: `${accent}55` }]}>
            <FontAwesome5 name="search" size={14} color={colors.fgSubtle} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder={searchPlaceholder}
              placeholderTextColor={colors.fgSubtle}
              style={styles.panelSearchInput}
              autoCorrect={false}
              autoCapitalize="none"
              selectionColor={accent}
            />
          </View>

          <FlatList
            data={filtered}
            keyExtractor={item => String(item.category_id)}
            keyboardShouldPersistTaps="always"
            showsVerticalScrollIndicator={false}
            style={styles.panelList}
            contentContainerStyle={styles.panelListContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No categories found</Text>
            }
            renderItem={({ item }) => {
              const active = item.category_id === activeCategoryId;
              return (
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => handleSelect(item)}
                  style={[
                    styles.row,
                    active && { backgroundColor: `${accent}1f` },
                  ]}
                >
                  <Text
                    style={[styles.rowText, active && styles.rowTextActive]}
                    numberOfLines={1}
                  >
                    {item.category_name}
                  </Text>
                  {active && (
                    <FontAwesome5 name="check" size={13} color={accent} />
                  )}
                </TouchableOpacity>
              );
            }}
          />
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'relative',
    zIndex: 40,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  trigger: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
    paddingLeft: 6,
    paddingRight: 8,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  triggerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  triggerBody: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    fontFamily: FONT,
    fontSize: 10,
    fontWeight: '500',
    letterSpacing: 1.6,
  },
  triggerNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  triggerName: {
    flexShrink: 1,
    fontFamily: FONT,
    fontSize: 20,
    fontWeight: '600',
    color: colors.fg,
  },
  chevron: {
    flexShrink: 0,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    flexShrink: 0,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    flexShrink: 0,
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
  },
  panel: {
    position: 'absolute',
    left: 20,
    right: 20,
    zIndex: 2,
    borderRadius: radii.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 6,
    maxHeight: 420,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 24,
  },
  panelSearch: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 44,
    paddingHorizontal: 12,
    margin: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
  },
  panelSearchInput: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 15,
    color: colors.fg,
    padding: 0,
  },
  panelList: {
    maxHeight: 340,
  },
  panelListContent: {
    paddingBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  rowText: {
    flex: 1,
    fontFamily: FONT,
    fontSize: 14,
    fontWeight: '600',
    color: colors.fgMuted,
  },
  rowTextActive: {
    color: colors.fg,
  },
  emptyText: {
    fontFamily: FONT,
    fontSize: 13,
    color: colors.fgSubtle,
    textAlign: 'center',
    paddingVertical: 24,
  },
});
