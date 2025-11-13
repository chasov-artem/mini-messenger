import { configureStore, createSlice, PayloadAction } from "@reduxjs/toolkit";
import { persistStore, persistReducer } from "redux-persist";
import storage from "redux-persist/lib/storage";

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

type ThemeState = {
  mode: "light" | "dark";
};

const initialThemeState: ThemeState = { mode: "light" };

const themeSlice = createSlice({
  name: "theme",
  initialState: initialThemeState,
  reducers: {
    setTheme(state, action: PayloadAction<"light" | "dark">) {
      state.mode = action.payload;
    },
    toggleTheme(state) {
      state.mode = state.mode === "light" ? "dark" : "light";
    },
  },
});

export const { setTheme, toggleTheme } = themeSlice.actions;

const userPersistConfig = {
  key: "user",
  storage,
};

const themePersistConfig = {
  key: "theme",
  storage,
};

const persistedUserReducer = persistReducer(
  userPersistConfig,
  userSlice.reducer,
);
const persistedThemeReducer = persistReducer(
  themePersistConfig,
  themeSlice.reducer,
);

export const store = configureStore({
  reducer: {
    user: persistedUserReducer,
    theme: persistedThemeReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        ignoredActions: [
          "persist/PERSIST",
          "persist/REHYDRATE",
          "persist/REGISTER",
        ],
      },
    }),
  devTools: process.env.NODE_ENV !== "production",
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
