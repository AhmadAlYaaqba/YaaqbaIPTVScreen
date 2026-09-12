// src/screens/SeriesCategoriesScreen.tsx
import React, { useEffect } from 'react';
import { View, FlatList, TouchableOpacity, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useDispatch, useSelector } from 'react-redux';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LegacyStackParamList } from '../navigation/legacyTypes';
import { RootState, AppDispatch } from '../store';
import { fetchSeriesCategories } from '../store/slices/iptvSlice';

type SeriesCategoriesNavProp = NativeStackNavigationProp<LegacyStackParamList, 'SeriesCategories'>;

interface Props {
  navigation: SeriesCategoriesNavProp;
}

const SeriesCategoriesScreen: React.FC<Props> = ({ navigation }) => {
  const dispatch = useDispatch<AppDispatch>();
  const { username, password, serverDomain, serverPort } = useSelector((state: RootState) => state.user);
  const { seriesCategories, loading, error } = useSelector((state: RootState) => state.iptv);

  useEffect(() => {
    dispatch(fetchSeriesCategories({ username, password, domain: serverDomain, port: serverPort }));
  }, [dispatch, username, password, serverDomain, serverPort]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  const renderCategory = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={styles.categoryItem}
        onPress={() => {
          navigation.navigate('SeriesList', {
            categoryId: item.category_id,
            categoryName: item.category_name,
          });
        }}
      >
        <Text style={styles.categoryText}>{item.category_name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={seriesCategories}
        keyExtractor={(item, idx) => item.category_id || idx.toString()}
        renderItem={renderCategory}
      />
    </View>
  );
};

export default SeriesCategoriesScreen;

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorText: { color: 'red' },
  categoryItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  categoryText: {
    fontSize: 16,
  },
});
