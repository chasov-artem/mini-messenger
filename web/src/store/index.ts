import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";

type UserState = {
  id: string | null;
  username: string | null;
};

const initialUserState: UserState = { id: null, username: null };

const userSlice = createSlice({
  name: "user",
  initialState: initialUserState,
  reducers: {
    setUser(state, action: PayloadAction<{ id: string; username: string }>) {
      state.id = action.payload.id;
      state.username = action.payload.username;
    },
    clearUser(state) {
      state.id = null;
      state.username = null;
    },
  },
});

export const { setUser, clearUser } = userSlice.actions;

export const store = configureStore({
  reducer: {
    user: userSlice.reducer,
  },
  devTools: process.env.NODE_ENV !== "production",
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;


