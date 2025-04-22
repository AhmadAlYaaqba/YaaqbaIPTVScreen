// src/store/index.ts
import {configureStore} from '@reduxjs/toolkit';
import userReducer from './slices/userSlice';
import iptvReducer from './slices/iptvSlice';

export const store = configureStore({
  reducer: {
    user: userReducer,
    iptv: iptvReducer,
  },
});

// Types for our global state and dispatch
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;