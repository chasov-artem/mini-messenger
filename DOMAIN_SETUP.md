# 🌐 Налаштування власного домену через HostIQ

Ця інструкція допоможе вам налаштувати власний домен для вашого месенджера, який задеплоєний на Vercel (фронтенд) та Render (бекенд).

## 📋 Передумови

- Домен куплено на HostIQ
- Проект вже задеплоєний на Vercel та Render
- Доступ до панелі управління HostIQ

---

## 🎯 Варіанти налаштування

### Варіант 1: Один домен з піддоменами (рекомендовано)
- `yourdomain.com` → Vercel (фронтенд)
- `api.yourdomain.com` → Render (бекенд)

### Варіант 2: Два окремі домени
- `yourdomain.com` → Vercel (фронтенд)
- `api-yourdomain.com` → Render (бекенд)

**Рекомендую Варіант 1** - він простіший та професійніший.

---

## 🔵 Крок 1: Налаштування Render (Backend)

### 1.1 Додайте Custom Domain в Render

1. Перейдіть на https://render.com
2. Виберіть ваш **Web Service** (бекенд)
3. Перейдіть в **Settings** → **Custom Domains**
4. Натисніть **"Add Custom Domain"**
5. Введіть піддомен (наприклад: `api.yourdomain.com`)
6. Render покаже вам **DNS записи**, які потрібно додати:
   - Тип: `CNAME`
   - Ім'я: `api` (або ваш піддомен)
   - Значення: `your-app.onrender.com` (ваш Render URL)

### 1.2 Налаштування DNS в HostIQ

1. Увійдіть в панель HostIQ
2. Перейдіть в **DNS Management** або **Управління DNS**
3. Знайдіть ваш домен
4. Додайте новий запис:
   - **Тип:** `CNAME`
   - **Ім'я/Хост:** `api` (або ваш піддомен)
   - **Значення/Посилання:** `your-app.onrender.com` (ваш Render URL)
   - **TTL:** `3600` (або за замовчуванням)

### 1.3 Очікування активації

- Render перевірить DNS записи (зазвичай 5-15 хвилин)
- Після активації ви побачите статус "Active" в Render
- SSL сертифікат буде автоматично видано (Let's Encrypt)

### 1.4 Перевірка

Перевірте, що бекенд доступний:
```bash
curl https://api.yourdomain.com/health
# Має повернути: {"status":"ok"}
```

---

## 🟢 Крок 2: Налаштування Vercel (Frontend)

### 2.1 Додайте Custom Domain в Vercel

1. Перейдіть на https://vercel.com
2. Виберіть ваш проект
3. Перейдіть в **Settings** → **Domains**
4. Натисніть **"Add Domain"**
5. Введіть ваш домен (наприклад: `yourdomain.com` або `www.yourdomain.com`)
6. Vercel покаже вам **DNS записи**:
   - Для кореневого домену (`yourdomain.com`):
     - Тип: `A` або `CNAME`
     - Значення: IP адреси або CNAME від Vercel
   - Для `www.yourdomain.com`:
     - Тип: `CNAME`
     - Значення: `cname.vercel-dns.com`

### 2.2 Налаштування DNS в HostIQ

#### Для кореневого домену (`yourdomain.com`):

**Варіант A: A-записи (рекомендовано для кореневого домену)**
- Додайте 4 A-записи з IP адресами від Vercel:
  - **Тип:** `A`
  - **Ім'я:** `@` або залиште порожнім
  - **Значення:** IP адреси від Vercel (4 різні IP)
  - **TTL:** `3600`

**Варіант B: CNAME (якщо HostIQ підтримує CNAME для кореневого домену)**
- **Тип:** `CNAME`
- **Ім'я:** `@` або залиште порожнім
- **Значення:** `cname.vercel-dns.com`
- **TTL:** `3600`

#### Для www піддомену (`www.yourdomain.com`):
- **Тип:** `CNAME`
- **Ім'я:** `www`
- **Значення:** `cname.vercel-dns.com`
- **TTL:** `3600`

### 2.3 Очікування активації

- Vercel перевірить DNS записи (зазвичай 5-60 хвилин)
- Після активації ви побачите статус "Valid Configuration"
- SSL сертифікат буде автоматично видано

### 2.4 Перевірка

Відкрийте в браузері: `https://yourdomain.com`
- Має відкритися ваш додаток

---

## ⚙️ Крок 3: Оновлення Environment Variables

### 3.1 Оновіть змінні в Vercel

1. Перейдіть в **Settings** → **Environment Variables**
2. Оновіть значення:
   - `NEXT_PUBLIC_API_URL` = `https://api.yourdomain.com`
   - `NEXT_PUBLIC_WS_URL` = `wss://api.yourdomain.com`

3. **Важливо:** Після зміни змінних **передеплоїте** проект:
   - Перейдіть в **Deployments**
   - Натисніть **"Redeploy"** на останньому деплої

### 3.2 Налаштування CORS на Render (рекомендовано для продакшену)

Для безпеки краще обмежити дозволені домени:

1. Перейдіть в Render → **Environment Variables**
2. Додайте нову змінну:
   - **Key:** `ALLOWED_ORIGINS`
   - **Value:** `https://yourdomain.com,https://www.yourdomain.com`
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
1. Відкрийте `https://yourdomain.com`
2. Перевірте консоль браузера (F12):
   - Має бути: `🔍 API_BASE: https://api.yourdomain.com`
   - Не має бути помилок CORS

### 5.2 Перевірка Backend
1. Відкрийте `https://api.yourdomain.com/health`
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
1. Перевірте `NEXT_PUBLIC_API_URL` у Vercel
2. Оновіть CORS налаштування в `server/src/index.ts`:
   ```typescript
   app.use(cors({
     origin: [
       'https://yourdomain.com',
       'https://www.yourdomain.com',
       'https://your-vercel-app.vercel.app' // старий URL для сумісності
     ],
     credentials: true,
   }));
   ```
3. Передеплоїте бекенд на Render

### Проблема: WebSocket не підключається

**Рішення:**
1. Перевірте `NEXT_PUBLIC_WS_URL` у Vercel
2. Переконайтеся, що використовується `wss://` (не `ws://`)
3. Перевірте, що Render підтримує WebSocket через ваш кастомний домен

### Проблема: SSL сертифікат не видається

**Рішення:**
- Зачекайте до 24 годин
- Перевірте, що DNS записи правильні
- Перевірте, що домен не використовується на іншому сервісі
- Зверніться до підтримки Vercel/Render

---

## 📝 Швидкий чеклист

### HostIQ DNS:
- [ ] Додано CNAME для `api.yourdomain.com` → Render URL
- [ ] Додано A/CNAME для `yourdomain.com` → Vercel
- [ ] Додано CNAME для `www.yourdomain.com` → Vercel

### Render:
- [ ] Додано Custom Domain `api.yourdomain.com`
- [ ] DNS записи перевірені (статус "Active")
- [ ] SSL сертифікат активний

### Vercel:
- [ ] Додано Domain `yourdomain.com`
- [ ] DNS записи перевірені (статус "Valid Configuration")
- [ ] SSL сертифікат активний
- [ ] Оновлено `NEXT_PUBLIC_API_URL` = `https://api.yourdomain.com`
- [ ] Оновлено `NEXT_PUBLIC_WS_URL` = `wss://api.yourdomain.com`
- [ ] Проект передеплоєно

### Тестування:
- [ ] `https://yourdomain.com` відкривається
- [ ] `https://api.yourdomain.com/health` працює
- [ ] Реєстрація/логін працює
- [ ] Повідомлення відправляються
- [ ] WebSocket працює (реал-тайм повідомлення)

---

## 🎉 Готово!

Після виконання всіх кроків ваш додаток буде доступний на власному домені!

**Приклад конфігурації:**
- Frontend: `https://yourdomain.com`
- Backend API: `https://api.yourdomain.com`
- WebSocket: `wss://api.yourdomain.com`

---

## 📞 Додаткова інформація

### HostIQ підтримка:
- https://hostiq.ua/support
- Email: support@hostiq.ua

### Vercel документація:
- https://vercel.com/docs/concepts/projects/domains

### Render документація:
- https://render.com/docs/custom-domains
