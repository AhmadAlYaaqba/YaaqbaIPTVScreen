// src/screens/LiveChannelsScreen.tsx
import React, {useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import {useDispatch, useSelector} from 'react-redux';
import {StackNavigationProp} from '@react-navigation/stack';
import {RouteProp} from '@react-navigation/native';
import {RootStackParamList} from '../../RootNavigator';
import {RootState, AppDispatch} from '../store';

import {fetchLiveStreamsByCategory} from '../store/slices/iptvSlice';

type LiveChannelsScreenRouteProp = RouteProp<
  RootStackParamList,
  'LiveChannels'
>;
type LiveChannelsScreenNavProp = StackNavigationProp<
  RootStackParamList,
  'LiveChannels'
>;

interface Props {
  route: LiveChannelsScreenRouteProp;
  navigation: LiveChannelsScreenNavProp;
}

const LiveChannelsScreen: React.FC<Props> = ({route, navigation}) => {
  const {categoryId, categoryName} = route.params;

  const dispatch = useDispatch<AppDispatch>();

  const {username, password, serverDomain, serverPort} = useSelector(
    (state: RootState) => state.user,
  );
  const {liveChannels, loading, error} = useSelector(
    (state: RootState) => state.iptv,
  );

  useEffect(() => {
    navigation.setOptions({title: categoryName ?? 'Channels'});
    dispatch(
      fetchLiveStreamsByCategory({
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
        <Text style={styles.error}>Error: {error}</Text>
      </View>
    );
  }

  const renderChannel = ({item}: {item: any}) => {
    return (
      <TouchableOpacity
        style={styles.channelItem}
        onPress={() => {
          console.log('item ==>', item);
          // Construct the URL for the channel's actual stream
          // If Xtream Codes, you might have something like:
          // http://domain:port/live/USERNAME/PASSWORD/STREAM_ID.ts or .m3u8
          // or possibly you have 'item.url' directly

          const streamUrl = `http://${serverDomain}:${serverPort}/live/${username}/${password}/${item.stream_id}.m3u8`;
          console.log('streamUrl ==>', streamUrl);
          navigation.navigate('VideoPlayer', {
            streamUrl,
            channelName: item.name,
          });
        }}>
        <Text>{item.name}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={liveChannels}
        keyExtractor={(item, index) =>
          item.stream_id?.toString() || index.toString()
        }
        renderItem={renderChannel}
      />
    </View>
  );
};

export default LiveChannelsScreen;

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
  channelName: {
    fontSize: 16,
  },
});
