// src/store/slices/userSlice.ts
import {createSlice, PayloadAction} from '@reduxjs/toolkit';

interface UserState {
  username: string;
  password: string;
  serverDomain: string;
  serverPort: string;
  useVLC: boolean;
  // Potentially more fields:
  // token?: string;
  // isLoggedIn?: boolean;
}

const initialState: UserState = {
  username: '',
  password: '',
  serverDomain: '',
  serverPort: '',
  useVLC: true,
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
    clearUserCredentials: state => {
      return initialState;
    },
    setUseVlcPlayer: (state, action: PayloadAction<Partial<UserState>>) => {
      return {
        ...state,
        ...action.payload,
      };
    },
  },
});

export const {setUserCredentials, clearUserCredentials, setUseVlcPlayer} = userSlice.actions;

export default userSlice.reducer;
