// src/screens/HomeScreen.tsx
import React from 'react';
import {View, Button, StyleSheet} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import { RootStackParamList } from '../../RootNavigator';
import { useDispatch, useSelector } from 'react-redux';
import { setUseVlcPlayer } from '../store/slices/userSlice';
import { RootState } from '../store';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<Props> = ({navigation}) => {
  const dispatch = useDispatch();
  const playerStatus = useSelector((state: RootState) => state.user.useVLC);
  return (
    <View style={styles.container}>
      <Button title="Live Stream" onPress={() => navigation.navigate('Live')} />
      <Button title="Movies" onPress={() => navigation.navigate('Movies')} />
      <Button title="Series" onPress={() => navigation.navigate('Series')} />
      <Button
        title={`use VLC: ${playerStatus}`}
        onPress={() => {
          dispatch(setUseVlcPlayer({useVLC: !playerStatus}));
        }}
      />
    </View>
  );
};

export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 20,
  },
});
