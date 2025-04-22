// src/screens/MoviesScreen.tsx
import React, {useEffect} from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {RootState, AppDispatch} from '../store';
import {fetchMovieCategories} from '../store/slices/iptvSlice';
import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../../RootNavigator';

type MoviesScreenNavProp = StackNavigationProp<RootStackParamList, 'Movies'>;

interface Props {
  navigation: MoviesScreenNavProp;
}

const MoviesScreen: React.FC<Props> = ({navigation}) => {
  const dispatch = useDispatch<AppDispatch>();

  // Grab user info from store
  const {username, password, serverDomain, serverPort} = useSelector(
    (state: RootState) => state.user,
  );
  const {movieCategories, loading, error} = useSelector(
    (state: RootState) => state.iptv,
  );

  useEffect(() => {
    dispatch(
      fetchMovieCategories({
        username,
        password,
        domain: serverDomain,
        port: serverPort,
      }),
    );
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

  const renderCategory = ({item}: {item: any}) => {
    return (
      <TouchableOpacity
        style={styles.categoryItem}
        onPress={() => {
          navigation.navigate('MovieList', {
            categoryId: item.category_id,
            categoryName: item.category_name,
          });
        }}>
        <Text style={styles.categoryText}>{item.category_name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={movieCategories}
        keyExtractor={(item, idx) => item.category_id || idx.toString()}
        renderItem={renderCategory}
      />
    </View>
  );
};

export default MoviesScreen;

const styles = StyleSheet.create({
  container: {flex: 1, padding: 16},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  errorText: {color: 'red'},
  categoryItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  categoryText: {
    fontSize: 16,
  },
});
