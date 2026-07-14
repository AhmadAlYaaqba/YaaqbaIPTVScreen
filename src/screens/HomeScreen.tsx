// src/screens/HomeScreen.tsx
import React from 'react';
import {View, Button, StyleSheet} from 'react-native';
import {StackNavigationProp} from '@react-navigation/stack';
import { RootStackParamList } from '../../RootNavigator';
import { useDispatch, useSelector } from 'react-redux';
import { setUserPreferences } from '../store/slices/userSlice';
import { RootState } from '../store';
import { PLAYER_ENGINES } from '../types/player';

type HomeScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Home'>;

interface Props {
  navigation: HomeScreenNavigationProp;
}

const HomeScreen: React.FC<Props> = ({navigation}) => {
  const dispatch = useDispatch();
  const playerEngine = useSelector((state: RootState) => state.user.playerEngine);
  return (
    <View style={styles.container}>
      <Button title="Live Stream" onPress={() => navigation.navigate('Live')} />
      <Button title="Movies" onPress={() => navigation.navigate('Movies')} />
      <Button title="Series" onPress={() => navigation.navigate('Series')} />
      <Button
        title={`Engine: ${playerEngine}`}
        onPress={() => {
          // Dev-only session cycler (not persisted; Settings is the real UI).
          const next =
            PLAYER_ENGINES[
              (PLAYER_ENGINES.indexOf(playerEngine) + 1) % PLAYER_ENGINES.length
            ];
          dispatch(setUserPreferences({ playerEngine: next }));
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
