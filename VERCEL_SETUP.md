# 🚀 Налаштування Vercel для Frontend

## Твій Backend URL:
```
https://mini-messenger-2.onrender.com
```

---

## 📋 Крок 1: Створення проекту на Vercel

1. Зайди на [Vercel Dashboard](https://vercel.com/dashboard)
2. Натисни **"Add New..."** → **"Project"**
3. Підключи GitHub репозиторій (якщо ще не підключений)
4. Обери репозиторій `mesendger`

---

## ⚙️ Крок 2: Налаштування проекту

### Основні налаштування:

- **Framework Preset:** `Next.js` ✅ (автоматично визначиться)
- **Root Directory:** `web` ⚠️ **ВАЖЛИВО!**
- **Build Command:** `npm run build` (за замовчуванням)
- **Output Directory:** `.next` (за замовчуванням)
- **Install Command:** `npm install` (за замовчуванням)

---

## 🔐 Крок 3: Environment Variables

**ВАЖЛИВО:** Додай ці змінні ПЕРЕД деплоєм!

Натисни **"Environment Variables"** і додай:

### 1. API URL:
```
NEXT_PUBLIC_API_URL=https://mini-messenger-2.onrender.com
```

### 2. WebSocket URL:
```
NEXT_PUBLIC_WS_URL=wss://mini-messenger-2.onrender.com
```

⚠️ **Зверни увагу:**
- Використовуй `https://` для API
- Використовуй `wss://` (не `ws://`) для WebSocket
- **БЕЗ слеша в кінці!** (не `https://.../`)

---

## 🚀 Крок 4: Деплой

1. Переконайся, що Environment Variables додані
2. Натисни **"Deploy"**
3. Дочекайся завершення білду (2-5 хвилин)
4. Скопіюй URL фронтенду (наприклад: `https://mini-messenger.vercel.app`)

---

## ✅ Крок 5: Перевірка

1. Відкрий URL фронтенду в браузері
2. Створи користувача
3. Створи чат
4. Відправ повідомлення
5. Перевір WebSocket:
   - Відкрий DevTools (F12)
   - Вкладка **Network** → **WS**
   - Має бути активне WebSocket з'єднання

---

## 🐛 Якщо щось не працює:

### Frontend не підключається до Backend:
- Перевір, що `NEXT_PUBLIC_API_URL` = `https://mini-messenger-2.onrender.com` (без слеша)
- Перевір, що backend працює: відкрий `https://mini-messenger-2.onrender.com/health` (має бути `{"status":"ok"}`)

### WebSocket не працює:
- Перевір, що `NEXT_PUBLIC_WS_URL` = `wss://mini-messenger-2.onrender.com` (не `ws://`)
- Перевір логи WebSocket у DevTools → Network → WS

### Помилки під час білду:
- Переконайся, що Root Directory = `web`
- Перевір логи білду в Vercel Dashboard

---

## 📝 Checklist:

- [ ] Проект створено на Vercel
- [ ] Root Directory = `web`
- [ ] `NEXT_PUBLIC_API_URL` = `https://mini-messenger-2.onrender.com`
- [ ] `NEXT_PUBLIC_WS_URL` = `wss://mini-messenger-2.onrender.com`
- [ ] Деплой завершено успішно
- [ ] Frontend працює
- [ ] WebSocket з'єднання працює

---

## 🎉 Готово!

Твій міні-месенджер тепер доступний онлайн! 🚀

**Backend:** https://mini-messenger-2.onrender.com  
**Frontend:** https://твій-vercel-url.vercel.app

