import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {RootState, AppDispatch} from '../store';
// Suppose you have a fetchSeries thunk
import {fetchSeries} from '../store/slices/iptvSlice';
import {StackNavigationProp} from '@react-navigation/stack';
import { RootStackParamList } from '../../RootNavigator';

type SieresScreenNavigationProp = StackNavigationProp<
  RootStackParamList,
  'Series'
>;

interface Props {
  navigation: SieresScreenNavigationProp;
}

const SieresScreen: React.FC<Props> = () => {
  const dispatch = useDispatch<AppDispatch>();
  const {username, password, serverDomain, serverPort} = useSelector(
    (state: RootState) => state.user,
  );
  const {seriesCategories, loading, error} = useSelector(
    (state: RootState) => state.iptv,
  );

  useEffect(() => {
    dispatch(
      fetchSeries({username, password, domain: serverDomain, port: serverPort}),
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
        <Text style={styles.error}>Error: {error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={seriesCategories}
        keyExtractor={(item, index) => item.category_id || index.toString()}
        renderItem={({item}) => (
          <View style={styles.item}>
            <Text>{item.category_name}</Text>
          </View>
        )}
      />
    </View>
  );
};

export default SieresScreen;

const styles = StyleSheet.create({
  container: {flex: 1},
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  error: {color: 'red'},
  item: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
});
