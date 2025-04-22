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
import FastImage from 'react-native-fast-image'; // 1) Import FastImage
import { useDispatch, useSelector } from 'react-redux';
import { RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootState, AppDispatch } from '../store';
import { fetchSeriesByCategory } from '../store/slices/iptvSlice';
import { RootStackParamList } from '../../RootNavigator';

type SeriesListRouteProp = RouteProp<RootStackParamList, 'SeriesList'>;
type SeriesListNavProp = StackNavigationProp<RootStackParamList, 'SeriesList'>;

interface Props {
  route: SeriesListRouteProp;
  navigation: SeriesListNavProp;
}

const SeriesListScreen: React.FC<Props> = ({ route, navigation }) => {
  const { categoryId, categoryName } = route.params;
  const dispatch = useDispatch<AppDispatch>();
  const { username, password, serverDomain, serverPort } = useSelector(
    (state: RootState) => state.user
  );
  const { seriesList, loading, error } = useSelector((state: RootState) => state.iptv);

  useEffect(() => {
    navigation.setOptions({ title: categoryName || 'Series' });
    dispatch(
      fetchSeriesByCategory({
        username,
        password,
        domain: serverDomain,
        port: serverPort,
        categoryId,
      })
    );
  }, [categoryId, categoryName, dispatch]);

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
        }}
      >
        <FastImage
          style={styles.poster}
          source={{
            uri: item.cover, // or item.stream_icon if your server uses that
            priority: FastImage.priority.normal,
          }}
          resizeMode={FastImage.resizeMode.cover}
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