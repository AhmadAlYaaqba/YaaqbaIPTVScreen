// src/screens/MovieDetailScreen.tsx
import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LegacyStackParamList } from '../navigation/legacyTypes';
import { useSelector } from 'react-redux';
import { RootState } from '../store';
import { proxyStreamUrl } from '../utils/proxy';
import { buildMovieStreamUrl } from '../utils/xtream';
import CachedRemoteImage from '../components/CachedRemoteImage';

type MovieDetailRouteProp = RouteProp<LegacyStackParamList, 'MovieDetail'>;
type MovieDetailNavProp = NativeStackNavigationProp<
  LegacyStackParamList,
  'MovieDetail'
>;

interface Props {
  route: MovieDetailRouteProp;
  navigation: MovieDetailNavProp;
}

// For Xtream: typically you can glean details like name, stream_icon, etc.
const MovieDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { movie } = route.params; // movie is an object from the list
  const { stream_id, name, stream_icon, container_extension } = movie;

  const { playlistId, username, password, serverDomain, serverPort, useProxy } =
    useSelector((state: RootState) => state.user);

  // If you want to create a "movie URL" for playback:
  // Typically: http://domain:port/movie/USERNAME/PASSWORD/stream_id.(mp4 or mkv)
  // The extension depends on the container your server uses.
  // e.g. `http://${domain}:${port}/movie/${username}/${password}/${stream_id}.mp4`

  // For the sake of example:
  const handlePlay = () => {
    const originalStreamUrl = buildMovieStreamUrl({
      domain: serverDomain,
      port: serverPort,
      username,
      password,
      streamId: stream_id,
      extension: container_extension,
    });
    const streamUrl = proxyStreamUrl(originalStreamUrl, useProxy);
    navigation.navigate('VideoPlayer', {
      streamUrl,
      // or if it's .m3u8, you'd adapt accordingly
    });
  };

  return (
    <View style={styles.container}>
      {stream_icon ? (
        <CachedRemoteImage
          uri={stream_icon}
          playlistId={playlistId}
          contentId={stream_id}
          variant="poster"
          style={styles.poster}
          displayWidth={200}
          displayHeight={300}
        />
      ) : null}
      <Text style={styles.title}>{name}</Text>
      <Text>Some other details (Year, Plot, etc.)...</Text>

      <Button title="Play" onPress={handlePlay} />
    </View>
  );
};

export default MovieDetailScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  poster: {
    width: 200,
    height: 300,
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    marginBottom: 8,
  },
});
