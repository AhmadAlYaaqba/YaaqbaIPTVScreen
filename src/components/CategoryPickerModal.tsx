// src/components/CategoryPickerModal.tsx
import React, { useState, useCallback, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TextInput,
    FlatList,
    TouchableOpacity,
    TouchableWithoutFeedback,
    Dimensions,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withTiming,
    withSpring,
    Easing,
} from 'react-native-reanimated';
import FontAwesome5 from 'react-native-vector-icons/FontAwesome5';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const MODAL_HEIGHT = SCREEN_HEIGHT * 0.7;

interface Category {
    category_id: string;
    category_name: string;
}

interface CategoryPickerModalProps {
    visible: boolean;
    categories: Category[];
    activeCategory: string | null;
    onSelect: (categoryId: string, categoryName: string) => void;
    onClose: () => void;
}

// TouchableWithoutFeedback is used for backdrop instead of AnimatedPressable
// to avoid gesture competition with list items on Android

const CategoryItem = React.memo(
    ({
        item,
        isActive,
        onPress,
    }: {
        item: Category;
        isActive: boolean;
        onPress: () => void;
    }) => (
        <TouchableOpacity
            style={[styles.categoryItem, isActive && styles.categoryItemActive]}
            onPress={onPress}
            activeOpacity={0.7}>
            <View style={styles.categoryLeft}>
                <View
                    style={[
                        styles.categoryDot,
                        isActive && styles.categoryDotActive,
                    ]}
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
            {isActive && (
                <FontAwesome5 name="check" size={14} color="#4A90E2" />
            )}
        </TouchableOpacity>
    ),
);

const CategoryPickerModal: React.FC<CategoryPickerModalProps> = ({
    visible,
    categories,
    activeCategory,
    onSelect,
    onClose,
}) => {
    const [search, setSearch] = useState('');
    const translateY = useSharedValue(MODAL_HEIGHT);
    const backdropOpacity = useSharedValue(0);

    useEffect(() => {
        if (visible) {
            setSearch('');
            translateY.value = withSpring(0, {
                damping: 20,
                stiffness: 150,
                mass: 0.8,
            });
            backdropOpacity.value = withTiming(1, {
                duration: 250,
                easing: Easing.out(Easing.cubic),
            });
        } else {
            translateY.value = withTiming(MODAL_HEIGHT, {
                duration: 250,
                easing: Easing.in(Easing.cubic),
            });
            backdropOpacity.value = withTiming(0, { duration: 200 });
        }
    }, [visible]);

    const animatedModalStyle = useAnimatedStyle(() => ({
        transform: [{ translateY: translateY.value }],
    }));

    const animatedBackdropStyle = useAnimatedStyle(() => ({
        opacity: backdropOpacity.value,
    }));

    const filteredCategories = categories.filter(c =>
        c.category_name.toLowerCase().includes(search.toLowerCase()),
    );

    const handleSelect = useCallback(
        (categoryId: string, categoryName: string) => {
            onSelect(categoryId, categoryName);
        },
        [onSelect],
    );

    const renderItem = useCallback(
        ({ item }: { item: Category }) => (
            <CategoryItem
                item={item}
                isActive={item.category_id === activeCategory}
                onPress={() => handleSelect(item.category_id, item.category_name)}
            />
        ),
        [activeCategory, handleSelect],
    );

    const keyExtractor = useCallback(
        (item: Category) => item.category_id.toString(),
        [],
    );

    if (!visible) return null;

    return (
        <View style={[StyleSheet.absoluteFill, { zIndex: 100, elevation: 100 }]} pointerEvents="box-none">
            {/* Backdrop — TouchableWithoutFeedback avoids gesture competition with list items on Android */}
            <TouchableWithoutFeedback onPress={onClose}>
                <Animated.View style={[styles.backdrop, animatedBackdropStyle]} />
            </TouchableWithoutFeedback>

            {/* Modal content — onStartShouldSetResponder prevents touches from propagating to backdrop */}
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={styles.modalContainer}
                pointerEvents="box-none">
                <Animated.View
                    style={[styles.modalContent, animatedModalStyle]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <View style={styles.dragHandle} />
                        <View style={styles.headerRow}>
                            <Text style={styles.headerTitle}>Categories</Text>
                            <TouchableOpacity
                                onPress={onClose}
                                style={styles.closeButton}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                <FontAwesome5 name="times" size={18} color="#666" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Search */}
                    <View style={styles.searchContainer}>
                        <FontAwesome5
                            name="search"
                            size={14}
                            color="#999"
                            style={styles.searchIcon}
                        />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search categories..."
                            placeholderTextColor="#999"
                            value={search}
                            onChangeText={setSearch}
                            autoCorrect={false}
                            clearButtonMode="while-editing"
                        />
                    </View>

                    {/* Category count */}
                    <Text style={styles.countText}>
                        {filteredCategories.length} categories
                    </Text>

                    {/* List */}
                    <FlatList
                        data={filteredCategories}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        initialNumToRender={15}
                        maxToRenderPerBatch={10}
                        windowSize={5}
                    />
                </Animated.View>
            </KeyboardAvoidingView>
        </View>
    );
};

export default CategoryPickerModal;

const styles = StyleSheet.create({
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.6)',
    },
    modalContainer: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    modalContent: {
        height: MODAL_HEIGHT,
        backgroundColor: '#1E293B',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        overflow: 'hidden',
        borderTopWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.4,
        shadowRadius: 16,
        elevation: 10,
    },
    header: {
        alignItems: 'center',
        paddingTop: 12,
        paddingBottom: 4,
    },
    dragHandle: {
        width: 36,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
        marginBottom: 16,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        width: '100%',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#fff',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        marginHorizontal: 20,
        marginTop: 16,
        paddingHorizontal: 14,
        height: 48,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#fff',
        padding: 0,
    },
    countText: {
        fontSize: 13,
        color: '#A0ABC0',
        marginHorizontal: 20,
        marginTop: 14,
        marginBottom: 8,
    },
    listContent: {
        paddingHorizontal: 12,
        paddingBottom: 24,
    },
    categoryItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        marginVertical: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
        borderWidth: 1,
        borderColor: 'transparent',
    },
    categoryItemActive: {
        backgroundColor: 'rgba(74, 144, 226, 0.15)',
        borderColor: 'rgba(74, 144, 226, 0.3)',
    },
    categoryLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
    },
    categoryDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        marginRight: 14,
    },
    categoryDotActive: {
        backgroundColor: '#4A90E2',
        shadowColor: '#4A90E2',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 4,
        elevation: 2,
    },
    categoryName: {
        fontSize: 15,
        color: '#E2E8F0',
        flex: 1,
    },
    categoryNameActive: {
        color: '#fff',
        fontWeight: '600',
    },
});
