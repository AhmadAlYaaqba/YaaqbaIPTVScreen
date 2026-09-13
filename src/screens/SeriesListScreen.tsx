// src/screens/SeriesListScreen.tsx
import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Dimensions,
} from 'react-native';
import CachedRemoteImage from '../components/CachedRemoteImage';
import { useDispatch, useSelector } from 'react-redux';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootState, AppDispatch } from '../store';
import { fetchSeriesByCategory } from '../store/slices/iptvSlice';
import { LegacyStackParamList } from '../navigation/legacyTypes';

type SeriesListRouteProp = RouteProp<LegacyStackParamList, 'SeriesList'>;
type SeriesListNavProp = NativeStackNavigationProp<
  LegacyStackParamList,
  'SeriesList'
>;

interface Props {
  route: SeriesListRouteProp;
  navigation: SeriesListNavProp;
}

const SeriesListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId, categoryName } = route.params;
  const dispatch = useDispatch<AppDispatch>();
  const { playlistId, username, password, serverDomain, serverPort } =
    useSelector((state: RootState) => state.user);
  const { seriesList, loading, error } = useSelector(
    (state: RootState) => state.iptv,
  );

  useEffect(() => {
    navigation.setOptions({ title: categoryName || 'Series' });
    dispatch(
      fetchSeriesByCategory({
        username,
        password,
        domain: serverDomain,
        port: serverPort,
        categoryId,
      }),
    );
  }, [
    categoryId,
    categoryName,
    dispatch,
    navigation,
    password,
    serverDomain,
    serverPort,
    username,
  ]);

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
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }

  const renderSeries = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => {
          // Navigate to detail (seasons, episodes) screen
          navigation.navigate('SeriesDetail', {
            seriesId: item.series_id,
            seriesName: item.name,
          });
        }}>
        <CachedRemoteImage
          uri={item.cover}
          playlistId={playlistId}
          contentId={item.series_id ?? item.name}
          variant="poster"
          style={styles.poster}
          displayWidth={ITEM_WIDTH}
          displayHeight={ITEM_WIDTH * 1.5}
        />
        <Text style={styles.title} numberOfLines={1}>
          {item.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={seriesList}
        keyExtractor={(item, idx) => item.series_id || idx.toString()}
        renderItem={renderSeries}
        numColumns={3} // 3 columns per row
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

export default SeriesListScreen;

// ====== Styles ======
const { width } = Dimensions.get('window');
const ITEM_MARGIN = 4;
// 3 columns: subtract some margins from total width
const ITEM_WIDTH = (width - ITEM_MARGIN * 8) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  listContent: {
    padding: ITEM_MARGIN,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: 'red',
  },
  itemContainer: {
    width: ITEM_WIDTH,
    margin: ITEM_MARGIN,
    alignItems: 'center',
  },
  poster: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH * 1.5, // e.g. 2:3 aspect ratio
    borderRadius: 6,
    backgroundColor: '#ccc',
  },
  title: {
    marginTop: 4,
    fontSize: 14,
    color: '#000',
    textAlign: 'center',
  },
});
