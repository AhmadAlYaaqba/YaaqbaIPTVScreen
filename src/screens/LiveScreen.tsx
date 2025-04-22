// src/screens/LiveScreen.tsx
import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import {useSelector, useDispatch} from 'react-redux';
import {RootState, AppDispatch} from '../store';
import {fetchLiveChannels} from '../store/slices/iptvSlice';

import {StackNavigationProp} from '@react-navigation/stack';
import {RootStackParamList} from '../../RootNavigator';

type LiveScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Live'>;

interface Props {
  navigation: LiveScreenNavigationProp;
}

const LiveScreen: React.FC<Props> = ({navigation}) => {
  const dispatch = useDispatch<AppDispatch>();

  // Suppose user credentials are stored in userSlice
  const {username, password, serverDomain, serverPort} = useSelector(
    (state: RootState) => state.user,
  );
  console.log({username, password, serverDomain, serverPort});
  const {liveCategories, loading, error} = useSelector(
    (state: RootState) => state.iptv,
  );

  useEffect(() => {
    dispatch(
      fetchLiveChannels({
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
        <Text style={styles.error}>Error: {error}</Text>
      </View>
    );
  }

  // Render each channel in a list
  const renderChannel = ({item}: {item: any}) => {
    return (
      <TouchableOpacity
        style={styles.channelItem}
        onPress={() => {
          navigation.navigate('LiveChannels', {
            categoryId: item.category_id,
            categoryName: item.category_name,
          });
        }}>
        <Text>{item.category_name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={liveCategories}
        keyExtractor={(item, index) => item.category_id || index.toString()}
        renderItem={renderChannel}
      />
    </View>
  );
};

export default LiveScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: 'red',
  },
  channelItem: {
    padding: 16,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
});
