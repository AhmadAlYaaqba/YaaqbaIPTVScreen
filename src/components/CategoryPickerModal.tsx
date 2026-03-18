import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

type Category = {
  category_id: string;
  category_name: string;
};

type CategoryPickerModalProps = {
  visible: boolean;
  categories: Category[];
  activeCategory: string | null;
  onSelect: (categoryId: string, categoryName: string) => void;
  onClose: () => void;
};

const ESTIMATED_ROW_HEIGHT = 64;

const CategoryItem = React.memo(
  ({
    item,
    isActive,
    onPress,
  }: {
    item: Category;
    isActive: boolean;
    onPress: () => void;
  }) => {
    return (
      <Pressable
        onPress={onPress}
        android_ripple={{color: 'rgba(255,255,255,0.08)'}}
        style={({pressed}) => [
          styles.categoryItem,
          isActive && styles.categoryItemActive,
          pressed && styles.categoryItemPressed,
        ]}>
        <View style={styles.categoryLeft}>
          <View
            style={[styles.categoryDot, isActive && styles.categoryDotActive]}
          />
          <Text
            style={[
              styles.categoryName,
              isActive && styles.categoryNameActive,
            ]}
            numberOfLines={1}>
            {item.category_name}
          </Text>
        </View>

        {isActive ? (
          <FontAwesome5 name="check" size={14} color="#4A90E2" />
        ) : null}
      </Pressable>
    );
  },
);

function EmptyState({hasSearch}: {hasSearch: boolean}) {
  return (
    <View style={styles.emptyState}>
      <FontAwesome5
        name={hasSearch ? 'search' : 'layer-group'}
        size={18}
        color="#94A3B8"
      />
      <Text style={styles.emptyTitle}>
        {hasSearch ? 'No matching categories' : 'No categories available'}
      </Text>
      <Text style={styles.emptySubtitle}>
        {hasSearch
          ? 'Try a different search term.'
          : 'Categories will appear here once they load.'}
      </Text>
    </View>
  );
}

export default function CategoryPickerModal({
  visible,
  categories,
  activeCategory,
  onSelect,
  onClose,
}: CategoryPickerModalProps) {
  const {height: windowHeight} = useWindowDimensions();
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (visible) {
      setSearch('');
    }
  }, [visible]);

  const safeCategories = useMemo(
    () => (Array.isArray(categories) ? categories : []),
    [categories],
  );

  const normalizedSearch = search.trim().toLowerCase();
  const filteredCategories = useMemo(() => {
    if (!normalizedSearch) {
      return safeCategories;
    }

    return safeCategories.filter(category =>
      category.category_name?.toLowerCase().includes(normalizedSearch),
    );
  }, [normalizedSearch, safeCategories]);

  const sheetHeight = Math.min(windowHeight * 0.72, 640);

  const handleSelect = useCallback(
    (categoryId: string, categoryName: string) => {
      onSelect(categoryId, categoryName);
    },
    [onSelect],
  );

  const renderItem = useCallback(
    ({item}: {item: Category}) => (
      <CategoryItem
        item={item}
        isActive={item.category_id === activeCategory}
        onPress={() => handleSelect(item.category_id, item.category_name)}
      />
    ),
    [activeCategory, handleSelect],
  );

  const keyExtractor = useCallback(
    (item: Category) => String(item.category_id),
    [],
  );

  const getItemLayout = useCallback(
    (_: ArrayLike<Category> | null | undefined, index: number) => ({
      length: ESTIMATED_ROW_HEIGHT,
      offset: ESTIMATED_ROW_HEIGHT * index,
      index,
    }),
    [],
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      hardwareAccelerated
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View style={styles.sheetWrapper} pointerEvents="box-none">
          <View style={[styles.sheet, {maxHeight: sheetHeight}]}>
            <View style={styles.header}>
              <View style={styles.dragHandle} />
              <View style={styles.headerRow}>
                <Text style={styles.headerTitle}>Categories</Text>
                <Pressable
                  onPress={onClose}
                  hitSlop={10}
                  android_ripple={{color: 'rgba(255,255,255,0.08)', radius: 18}}
                  style={({pressed}) => [
                    styles.closeButton,
                    pressed && styles.closeButtonPressed,
                  ]}>
                  <FontAwesome5 name="times" size={18} color="#CBD5E1" />
                </Pressable>
              </View>
            </View>

            <View style={styles.searchContainer}>
              <FontAwesome5
                name="search"
                size={14}
                color="#94A3B8"
                style={styles.searchIcon}
              />
              <TextInput
                value={search}
                onChangeText={setSearch}
                style={styles.searchInput}
                placeholder="Search categories..."
                placeholderTextColor="#94A3B8"
                autoCorrect={false}
                autoCapitalize="none"
                clearButtonMode="while-editing"
                selectionColor="#4A90E2"
              />
            </View>

            <Text style={styles.countText}>
              {filteredCategories.length} categories
            </Text>

            <FlatList
              data={filteredCategories}
              keyExtractor={keyExtractor}
              renderItem={renderItem}
              getItemLayout={getItemLayout}
              keyboardShouldPersistTaps="always"
              keyboardDismissMode="none"
              nestedScrollEnabled
              removeClippedSubviews={false}
              overScrollMode="never"
              showsVerticalScrollIndicator={false}
              contentContainerStyle={
                filteredCategories.length > 0
                  ? styles.listContent
                  : styles.emptyListContent
              }
              ListEmptyComponent={
                <EmptyState hasSearch={normalizedSearch.length > 0} />
              }
              initialNumToRender={20}
              maxToRenderPerBatch={20}
              windowSize={10}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(2, 6, 23, 0.68)',
  },
  sheetWrapper: {
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderTopWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    elevation: 24,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: -6},
    shadowOpacity: 0.35,
    shadowRadius: 18,
  },
  header: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 6,
  },
  dragHandle: {
    width: 36,
    height: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.28)',
    marginBottom: 16,
  },
  headerRow: {
    width: '100%',
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  closeButtonPressed: {
    opacity: 0.85,
  },
  searchContainer: {
    marginTop: 16,
    marginHorizontal: 20,
    height: 48,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
  },
  searchIcon: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#FFFFFF',
    paddingVertical: 0,
  },
  countText: {
    marginTop: 14,
    marginBottom: 8,
    marginHorizontal: 20,
    color: '#A0ABC0',
    fontSize: 13,
  },
  listContent: {
    paddingHorizontal: 12,
    paddingBottom: 28,
  },
  emptyListContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 32,
  },
  categoryItem: {
    minHeight: 56,
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.03)',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  categoryItemActive: {
    backgroundColor: 'rgba(74,144,226,0.15)',
    borderColor: 'rgba(74,144,226,0.3)',
  },
  categoryItemPressed: {
    opacity: 0.9,
  },
  categoryLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 14,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  categoryDotActive: {
    backgroundColor: '#4A90E2',
  },
  categoryName: {
    flex: 1,
    color: '#E2E8F0',
    fontSize: 15,
  },
  categoryNameActive: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
  },
  emptyTitle: {
    marginTop: 12,
    color: '#E2E8F0',
    fontSize: 16,
    fontWeight: '600',
  },
  emptySubtitle: {
    marginTop: 6,
    color: '#94A3B8',
    fontSize: 13,
    textAlign: 'center',
  },
});
