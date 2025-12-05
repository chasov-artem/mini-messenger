# 🌐 Налаштування власного домену через HostIQ

Ця інструкція допоможе вам налаштувати власний домен для вашого месенджера, який задеплоєний на Vercel (фронтенд) та Render (бекенд).

## 📋 Передумови

- Домен куплено на HostIQ
- Проект вже задеплоєний на Vercel та Render
- Доступ до панелі управління HostIQ

---

## 🎯 Ваші домени

- **Frontend (Vercel):** `mini-messenger.chasov-dev.com`
- **Backend (Render):** `mini-messenger-s.chasov-dev.com`

---

## 🎯 Варіанти налаштування (загальна інформація)

### Варіант 1: Один домен з піддоменами (рекомендовано)
- `yourdomain.com` → Vercel (фронтенд)
- `api.yourdomain.com` → Render (бекенд)

### Варіант 2: Два окремі домени (ваш випадок)
- `mini-messenger.chasov-dev.com` → Vercel (фронтенд)
- `mini-messenger-s.chasov-dev.com` → Render (бекенд)

---

## 🔵 Крок 1: Налаштування Render (Backend)

### 1.1 Додайте Custom Domain в Render

1. Перейдіть на https://render.com
2. Виберіть ваш **Web Service** (бекенд)
3. Перейдіть в **Settings** → **Custom Domains**
4. Натисніть **"Add Custom Domain"**
5. Введіть піддомен: `mini-messenger-s.chasov-dev.com`
6. Render покаже вам **DNS записи**, які потрібно додати:
   - Тип: `CNAME`
   - Ім'я: `mini-messenger-s`
   - Значення: `your-app.onrender.com` (ваш Render URL, наприклад `mini-messenger-xxxx.onrender.com`)

### 1.2 Налаштування DNS в HostIQ

1. Увійдіть в панель HostIQ
2. Перейдіть в **DNS Management** або **Управління DNS**
3. Знайдіть ваш домен
4. Додайте новий запис:
   - **Тип:** `CNAME`
   - **Ім'я/Хост:** `mini-messenger-s`
   - **Значення/Посилання:** `your-app.onrender.com` (ваш Render URL, наприклад `mini-messenger-xxxx.onrender.com`)
   - **TTL:** `3600` (або за замовчуванням)

### 1.3 Очікування активації

- Render перевірить DNS записи (зазвичай 5-15 хвилин)
- Після активації ви побачите статус "Active" в Render
- SSL сертифікат буде автоматично видано (Let's Encrypt)

### 1.4 Перевірка

Перевірте, що бекенд доступний:
```bash
curl https://mini-messenger-s.chasov-dev.com/health
# Має повернути: {"status":"ok"}
```

---

## 🟢 Крок 2: Налаштування Vercel (Frontend)

### 2.1 Додайте Custom Domain в Vercel

1. Перейдіть на https://vercel.com
2. Виберіть ваш проект
3. Перейдіть в **Settings** → **Domains**
4. Натисніть **"Add Domain"**
5. Введіть ваш домен: `mini-messenger.chasov-dev.com`
6. Vercel покаже вам **DNS записи**:
   - Для піддомену (`mini-messenger.chasov-dev.com`):
     - Тип: `CNAME` (рекомендовано)
     - Значення: `cname.vercel-dns.com`

### 2.2 Налаштування DNS в HostIQ

#### Для піддомену (`mini-messenger.chasov-dev.com`):

**CNAME запис (рекомендовано):**
- **Тип:** `CNAME`
- **Ім'я:** `mini-messenger`
- **Значення:** `cname.vercel-dns.com`
- **TTL:** `3600`

**Альтернатива: A-записи (якщо HostIQ не підтримує CNAME для піддоменів)**
- Додайте 4 A-записи з IP адресами від Vercel (отримаєте в Vercel при додаванні домену)

### 2.3 Очікування активації

- Vercel перевірить DNS записи (зазвичай 5-60 хвилин)
- Після активації ви побачите статус "Valid Configuration"
- SSL сертифікат буде автоматично видано

### 2.4 Перевірка

Відкрийте в браузері: `https://mini-messenger.chasov-dev.com`
- Має відкритися ваш додаток

---

## ⚙️ Крок 3: Оновлення Environment Variables

### 3.1 Оновіть змінні в Vercel

1. Перейдіть в **Settings** → **Environment Variables**
2. Оновіть значення:
   - `NEXT_PUBLIC_API_URL` = `https://mini-messenger-s.chasov-dev.com`
   - `NEXT_PUBLIC_WS_URL` = `wss://mini-messenger-s.chasov-dev.com`

3. **Важливо:** Після зміни змінних **передеплоїте** проект:
   - Перейдіть в **Deployments**
   - Натисніть **"Redeploy"** на останньому деплої

### 3.2 Налаштування CORS на Render (рекомендовано для продакшену)

Для безпеки краще обмежити дозволені домени:

1. Перейдіть в Render → **Environment Variables**
2. Додайте нову змінну:
   - **Key:** `ALLOWED_ORIGINS`
   - **Value:** `https://mini-messenger.chasov-dev.com,https://www.mini-messenger.chasov-dev.com`
   - (Додайте всі ваші домени через кому)
3. Перезапустіть сервіс (Render зробить це автоматично після зміни змінних)

**Примітка:** Якщо змінна не встановлена, CORS дозволить всі домени (для розробки). Для продакшену обов'язково встановіть `ALLOWED_ORIGINS`.

---

## 🔒 Крок 4: Налаштування SSL (автоматично)

### Vercel
- SSL сертифікат видається автоматично через Let's Encrypt
- Перевірте статус в **Settings** → **Domains**

### Render
- SSL сертифікат також видається автоматично
- Перевірте статус в **Settings** → **Custom Domains**

---

## ✅ Крок 5: Перевірка роботи

### 5.1 Перевірка Frontend
1. Відкрийте `https://mini-messenger.chasov-dev.com`
2. Перевірте консоль браузера (F12):
   - Має бути: `🔍 API_BASE: https://mini-messenger-s.chasov-dev.com`
   - Не має бути помилок CORS

### 5.2 Перевірка Backend
1. Відкрийте `https://mini-messenger-s.chasov-dev.com/health`
2. Має повернути: `{"status":"ok"}`

### 5.3 Перевірка WebSocket
1. Відкрийте додаток
2. Зареєструйтеся/залогініться
3. Створіть чат
4. Відправте повідомлення
5. Перевірте, що повідомлення доставляються в реальному часі

---

## 🐛 Вирішення проблем

### Проблема: DNS записи не активуються

**Рішення:**
- Перевірте правильність DNS записів (без зайвих пробілів)
- Зачекайте до 24 годин (зазвичай 5-60 хвилин)
- Використовуйте онлайн інструменти для перевірки DNS:
  - https://dnschecker.org
  - https://www.whatsmydns.net

### Проблема: CORS помилки

**Рішення:**
1. Перевірте `NEXT_PUBLIC_API_URL` у Vercel (має бути `https://mini-messenger-s.chasov-dev.com`)
2. Перевірте `ALLOWED_ORIGINS` у Render (має містити `https://mini-messenger.chasov-dev.com`)
3. Переконайтеся, що немає зайвих пробілів у значенні `ALLOWED_ORIGINS`
4. Перезапустіть Render сервіс

### Проблема: WebSocket не підключається

**Рішення:**
1. Перевірте `NEXT_PUBLIC_WS_URL` у Vercel (має бути `wss://mini-messenger-s.chasov-dev.com`)
2. Переконайтеся, що використовується `wss://` (не `ws://`)
3. Перевірте консоль браузера на наявність помилок WebSocket
4. Перевірте, що Render підтримує WebSocket через ваш кастомний домен

### Проблема: SSL сертифікат не видається

**Рішення:**
- Зачекайте до 24 годин
- Перевірте, що DNS записи правильні
- Перевірте, що домен не використовується на іншому сервісі
- Зверніться до підтримки Vercel/Render

---

## 📝 Швидкий чеклист

### HostIQ DNS:
- [ ] Додано CNAME для `mini-messenger-s` → Render URL
- [ ] Додано CNAME для `mini-messenger` → Vercel (`cname.vercel-dns.com`)

### Render:
- [ ] Додано Custom Domain `mini-messenger-s.chasov-dev.com`
- [ ] DNS записи перевірені (статус "Active")
- [ ] SSL сертифікат активний
- [ ] Додано `ALLOWED_ORIGINS = https://mini-messenger.chasov-dev.com,https://www.mini-messenger.chasov-dev.com`
- [ ] Перезапущено сервіс після зміни змінних

### Vercel:
- [ ] Додано Domain `mini-messenger.chasov-dev.com`
- [ ] DNS записи перевірені (статус "Valid Configuration")
- [ ] SSL сертифікат активний
- [ ] Оновлено `NEXT_PUBLIC_API_URL` = `https://mini-messenger-s.chasov-dev.com`
- [ ] Оновлено `NEXT_PUBLIC_WS_URL` = `wss://mini-messenger-s.chasov-dev.com`
- [ ] Проект передеплоєно після зміни змінних

### Тестування:
- [ ] `https://mini-messenger.chasov-dev.com` відкривається
- [ ] `https://mini-messenger-s.chasov-dev.com/health` працює
- [ ] Консоль браузера показує правильний API_BASE
- [ ] Реєстрація/логін працює
- [ ] Повідомлення відправляються
- [ ] WebSocket працює (реал-тайм повідомлення)

---

## 🎉 Готово!

Після виконання всіх кроків ваш додаток буде доступний на власному домені!

**Ваша конфігурація:**
- Frontend: `https://mini-messenger.chasov-dev.com`
- Backend API: `https://mini-messenger-s.chasov-dev.com`
- WebSocket: `wss://mini-messenger-s.chasov-dev.com`

---

## 📞 Додаткова інформація

### HostIQ підтримка:
- https://hostiq.ua/support
- Email: support@hostiq.ua

### Vercel документація:
- https://vercel.com/docs/concepts/projects/domains

### Render документація:
- https://render.com/docs/custom-domains
