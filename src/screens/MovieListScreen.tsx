import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import FastImage from 'react-native-fast-image'; // 1) Import FastImage
import {RouteProp} from '@react-navigation/native';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../../RootNavigator';
import {useSelector, useDispatch} from 'react-redux';
import {RootState, AppDispatch} from '../store';
import {fetchMoviesInCategory} from '../store/slices/iptvSlice';

type MovieListScreenRouteProp = RouteProp<RootStackParamList, 'MovieList'>;
type MovieListScreenNavProp = StackNavigationProp<RootStackParamList, 'MovieList'>;

interface Props {
  route: MovieListScreenRouteProp;
  navigation: MovieListScreenNavProp;
}

const MovieListScreen: React.FC<Props> = ({route, navigation}) => {
  const {categoryId, categoryName} = route.params;
  const dispatch = useDispatch<AppDispatch>();

  const {username, password, serverDomain, serverPort} = useSelector(
    (state: RootState) => state.user
  );
  const {movieList, loading, error} = useSelector((state: RootState) => state.iptv);

  useEffect(() => {
    navigation.setOptions({title: categoryName || 'Movies'});
    dispatch(
      fetchMoviesInCategory({
        username,
        password,
        domain: serverDomain,
        port: serverPort,
        categoryId,
      }),
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

  const renderMovie = ({item}: {item: any}) => {
    return (
      <TouchableOpacity
        style={styles.itemContainer}
        onPress={() => {
          navigation.navigate('MovieDetail', {movie: item});
        }}>
        {/* 2) Use FastImage instead of Image */}
        <FastImage
          style={styles.poster}
          source={{
            uri: item.stream_icon, // or wherever your poster URL is
            priority: FastImage.priority.normal, // optional
            cache: FastImage.cacheControl.immutable, // optional
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
        data={movieList}
        keyExtractor={(item, idx) =>
          item.stream_id?.toString() || idx.toString()
        }
        renderItem={renderMovie}
        numColumns={3} // 3 columns
        contentContainerStyle={styles.listContent}
      />
    </View>
  );
};

export default MovieListScreen;

const {width} = Dimensions.get('window');
const ITEM_MARGIN = 4;
// 3 columns: subtract margins from total width, then divide
const ITEM_WIDTH = (width - ITEM_MARGIN * 8) / 3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: 'red',
  },
  listContent: {
    padding: ITEM_MARGIN,
  },
  itemContainer: {
    width: ITEM_WIDTH,
    margin: ITEM_MARGIN,
    alignItems: 'center',
  },
  poster: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH * 1.5, // 2:3 aspect ratio
    borderRadius: 6,
    backgroundColor: '#ccc',
  },
  title: {
    marginTop: 4,
    fontSize: 14,
    textAlign: 'center',
  },
});