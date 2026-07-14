// src/store/slices/userSlice.ts
import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { PlayerEngine, DEFAULT_PLAYER_ENGINE } from '../../types/player';

interface UserState {
  username: string;
  password: string;
  serverDomain: string;
  serverPort: string;
  playerEngine: PlayerEngine;
  useProxy: boolean;
  // Potentially more fields:
  // token?: string;
  // isLoggedIn?: boolean;
}

const initialState: UserState = {
  username: '',
  password: '',
  serverDomain: '',
  serverPort: '',
  playerEngine: DEFAULT_PLAYER_ENGINE,
  useProxy: true,
};

export const userSlice = createSlice({
  name: 'user',
  initialState,
  reducers: {
    setUserCredentials: (state, action: PayloadAction<Partial<UserState>>) => {
      // Merge the new partial values into the existing state
      return {
        ...state,
        ...action.payload,
      };
    },
    clearUserCredentials: () => {
      return initialState;
    },
    setUserPreferences: (state, action: PayloadAction<Partial<UserState>>) => {
      return {
        ...state,
        ...action.payload,
      };
    },
  },
});

export const { setUserCredentials, clearUserCredentials, setUserPreferences } = userSlice.actions;

export default userSlice.reducer;
