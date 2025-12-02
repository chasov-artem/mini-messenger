# 🚀 Покрокова інструкція для деплою

## 📋 Передумови

1. ✅ Репозиторій на GitHub (public або private)
2. ✅ Аккаунт на [Render.com](https://render.com) (безкоштовний)
3. ✅ Аккаунт на [Vercel.com](https://vercel.com) (безкоштовний)

---

## 🔧 Крок 1: Деплой Backend на Render

### 1.1 Створення Web Service

1. Зайди на [Render Dashboard](https://dashboard.render.com)
2. Натисни **"New +"** → **"Web Service"**
3. Підключи свій GitHub репозиторій:
   - Якщо репо приватний, авторизуйся через GitHub
   - Обери репозиторій `mesendger` (або як він називається)

### 1.2 Налаштування сервісу

Заповни форму:

- **Name:** `mini-messenger-backend` (або будь-яка назва)
- **Region:** `Frankfurt` (або найближчий до тебе)
- **Branch:** `main` (або `master`)
- **Root Directory:** `server` ⚠️ **ВАЖЛИВО!**
- **Environment:** `Docker`
- **Dockerfile Path:** `Dockerfile` (Render автоматично знайде його в `server/`)
- **Instance Type:** `Free` (для початку)

### 1.3 Environment Variables

Додай наступні змінні:

```
PORT=4000
DATABASE_URL=file:./prisma/dev.db
```

⚠️ **Примітка:** SQLite працює на Render, але дані можуть втрачатися при перезапуску. Для продакшену краще використати PostgreSQL (інструкція нижче).

### 1.4 Деплой

1. Натисни **"Create Web Service"**
2. Дочекайся завершення білду (зазвичай 5-10 хвилин)
3. Скопіюй URL сервісу (наприклад: `https://mini-messenger-backend.onrender.com`)

### 1.5 Перевірка

Відкрий в браузері: `https://your-backend-url.onrender.com/health`

Маєш побачити: `{"status":"ok"}`

---

## 🌐 Крок 2: Деплой Frontend на Vercel

### 2.1 Імпорт проекту

1. Зайди на [Vercel Dashboard](https://vercel.com/dashboard)
2. Натисни **"Add New..."** → **"Project"**
3. Підключи GitHub репозиторій (якщо ще не підключений)
4. Обери репозиторій `mesendger`

### 2.2 Налаштування проекту

Vercel автоматично визначить Next.js, але перевір:

- **Framework Preset:** `Next.js` ✅
- **Root Directory:** `web` ⚠️ **ВАЖЛИВО!**
- **Build Command:** `npm run build` (за замовчуванням)
- **Output Directory:** `.next` (за замовчуванням)
- **Install Command:** `npm install` (за замовчуванням)

### 2.3 Environment Variables

Додай наступні змінні (заміни `your-backend-url` на реальний URL з Render):

```
NEXT_PUBLIC_API_URL=https://your-backend-url.onrender.com
NEXT_PUBLIC_WS_URL=wss://your-backend-url.onrender.com
```

⚠️ **ВАЖЛИВО:** 
- Використовуй `https://` для API
- Використовуй `wss://` (не `ws://`) для WebSocket
- Без слеша в кінці URL!

### 2.4 Деплой

1. Натисни **"Deploy"**
2. Дочекайся завершення білду (зазвичай 2-5 хвилин)
3. Скопіюй URL фронтенду (наприклад: `https://mini-messenger.vercel.app`)

### 2.5 Перевірка

Відкрий URL фронтенду в браузері - має завантажитися додаток!

---

## ✅ Крок 3: Тестування

1. **Відкрий фронтенд URL** (Vercel)
2. **Створи користувача** (введи username)
3. **Створи чат**
4. **Відправ повідомлення**
5. **Перевір WebSocket:**
   - Відкрий DevTools (F12)
   - Вкладка **Network** → **WS**
   - Має бути активне WebSocket з'єднання

---

## 🔧 Опціонально: PostgreSQL для продакшену

SQLite може втрачати дані на Render. Для стабільності використай PostgreSQL:

### На Render:

1. Створи **PostgreSQL Database:**
   - **New +** → **PostgreSQL**
   - Обери **Free** план
   - Скопіюй **Internal Database URL**

2. Онови **Environment Variables** у Web Service:
   ```
   DATABASE_URL=postgresql://user:password@host:5432/dbname
   ```

3. Онови Prisma schema (`server/prisma/schema.prisma`):
   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

4. Передеплой сервіс - міграції запустяться автоматично

---

## 🐛 Troubleshooting

### Backend не запускається

- Перевір логи в Render Dashboard
- Переконайся, що `Root Directory` = `server`
- Перевір, що `DATABASE_URL` встановлено

### Frontend не підключається до Backend

- Перевір `NEXT_PUBLIC_API_URL` у Vercel (має бути `https://...`)
- Перевір CORS налаштування (зараз дозволено все)
- Перевір, що backend URL працює (`/health` endpoint)

### WebSocket не працює

- Перевір `NEXT_PUBLIC_WS_URL` (має бути `wss://...`, не `ws://`)
- Перевір логи WebSocket у DevTools → Network → WS
- Render підтримує WebSocket автоматично

### Дані втрачаються

- SQLite на Render може втрачати дані при перезапуску
- Використай PostgreSQL (інструкція вище)

---

## 📝 Checklist перед деплоєм

- [ ] Код закомічено і запушено в GitHub
- [ ] Backend деплойнуто на Render
- [ ] Backend URL працює (`/health` endpoint)
- [ ] Frontend деплойнуто на Vercel
- [ ] Environment variables встановлено на Vercel
- [ ] WebSocket URL використовує `wss://` (не `ws://`)
- [ ] Протестовано створення користувача
- [ ] Протестовано відправку повідомлень
- [ ] WebSocket з'єднання працює

---

## 🎉 Готово!

Твій міні-месенджер тепер доступний онлайн! 🚀

