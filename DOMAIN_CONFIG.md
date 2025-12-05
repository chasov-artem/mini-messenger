# 🌐 Конфігурація доменів для проекту

## 📍 Ваші домени

- **Frontend (Vercel):** `mini-messenger.chasov-dev.com`
- **Backend (Render):** `mini-messenger-s.chasov-dev.com`

---

## ⚙️ Environment Variables

### Vercel (Frontend)

Додайте/оновіть в **Settings** → **Environment Variables**:

```
NEXT_PUBLIC_API_URL = https://mini-messenger-s.chasov-dev.com
NEXT_PUBLIC_WS_URL = wss://mini-messenger-s.chasov-dev.com
```

### Render (Backend)

Додайте/оновіть в **Environment Variables**:

```
ALLOWED_ORIGINS = https://mini-messenger.chasov-dev.com,https://www.mini-messenger.chasov-dev.com
```

**Інші змінні Render (якщо ще не додано):**
```
JWT_SECRET = <ваш секретний ключ>
PORT = 4000 (або залиште Render автоматично призначити)
DATABASE_URL = file:./prisma/dev.db (або PostgreSQL URL якщо використовуєте)
```

---

## 🔧 DNS налаштування в HostIQ

### Для фронтенду (`mini-messenger.chasov-dev.com`)

**Варіант 1: CNAME (рекомендовано)**
- **Тип:** `CNAME`
- **Ім'я:** `mini-messenger`
- **Значення:** `cname.vercel-dns.com`
- **TTL:** `3600`

**Варіант 2: A-записи (якщо HostIQ не підтримує CNAME для піддоменів)**
- Додайте 4 A-записи з IP адресами від Vercel (отримаєте в Vercel при додаванні домену)

### Для бекенду (`mini-messenger-s.chasov-dev.com`)

- **Тип:** `CNAME`
- **Ім'я:** `mini-messenger-s`
- **Значення:** `<ваш-render-app>.onrender.com` (ваш Render URL, наприклад `mini-messenger-xxxx.onrender.com`)
- **TTL:** `3600`

---

## ✅ Швидкий чеклист налаштування

### 1. HostIQ DNS
- [ ] Додано CNAME для `mini-messenger` → `cname.vercel-dns.com`
- [ ] Додано CNAME для `mini-messenger-s` → `<ваш-render-app>.onrender.com`

### 2. Render
- [ ] Додано Custom Domain `mini-messenger-s.chasov-dev.com`
- [ ] DNS записи перевірені (статус "Active")
- [ ] SSL сертифікат активний
- [ ] Додано `ALLOWED_ORIGINS = https://mini-messenger.chasov-dev.com,https://www.mini-messenger.chasov-dev.com`
- [ ] Перезапущено сервіс після зміни змінних

### 3. Vercel
- [ ] Додано Domain `mini-messenger.chasov-dev.com`
- [ ] DNS записи перевірені (статус "Valid Configuration")
- [ ] SSL сертифікат активний
- [ ] Оновлено `NEXT_PUBLIC_API_URL = https://mini-messenger-s.chasov-dev.com`
- [ ] Оновлено `NEXT_PUBLIC_WS_URL = wss://mini-messenger-s.chasov-dev.com`
- [ ] Проект передеплоєно після зміни змінних

### 4. Перевірка
- [ ] `https://mini-messenger.chasov-dev.com` відкривається
- [ ] `https://mini-messenger-s.chasov-dev.com/health` повертає `{"status":"ok"}`
- [ ] Консоль браузера показує: `🔍 API_BASE: https://mini-messenger-s.chasov-dev.com`
- [ ] Реєстрація/логін працює
- [ ] Повідомлення відправляються
- [ ] WebSocket працює (реал-тайм повідомлення)

---

## 🐛 Якщо щось не працює

### Перевірка DNS
Використайте онлайн інструменти:
- https://dnschecker.org
- https://www.whatsmydns.net

Введіть `mini-messenger.chasov-dev.com` та `mini-messenger-s.chasov-dev.com` і перевірте, чи правильно резолвляться записи.

### Перевірка CORS
Якщо виникають CORS помилки:
1. Перевірте, що `ALLOWED_ORIGINS` в Render містить `https://mini-messenger.chasov-dev.com`
2. Переконайтеся, що немає зайвих пробілів у значенні
3. Перезапустіть Render сервіс

### Перевірка WebSocket
Якщо WebSocket не підключається:
1. Перевірте `NEXT_PUBLIC_WS_URL` у Vercel (має бути `wss://mini-messenger-s.chasov-dev.com`)
2. Переконайтеся, що використовується `wss://` (не `ws://`)
3. Перевірте консоль браузера на наявність помилок

---

## 📝 Примітки

- Після зміни DNS записів зачекайте 5-60 хвилин для активації
- SSL сертифікати видаються автоматично (може зайняти до 24 годин)
- Після зміни Environment Variables обов'язково передеплоїте проект
