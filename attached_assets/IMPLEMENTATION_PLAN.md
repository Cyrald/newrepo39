# План внесения изменений в Routes архитектуру

**Статус анализа:** ✅ ТЗ корректно и содержит детальный анализ проблем  
**Дата:** 29 ноября 2025

---

## 📋 КРАТКАЯ ВЕРСИЯ (Checklist для выбора)

### 🔴 КРИТИЧЕСКИЕ (Приоритет 1) - Блокируют production
- [ ] **1.1** Исправить LSP ошибки в support.routes.ts
- [ ] **1.2** Исправить Promocode Race Condition  
- [ ] **1.3** Исправить SQL Injection в WebSocket

### 🟡 ВЫСОКИЕ (Приоритет 2) - Необходимы для production
- [ ] **2.1** Добавить Zod валидацию (addresses, payment-cards)
- [ ] **2.2** Создать middleware проверки владения ресурсов
- [ ] **2.3** Централизовать обработку ошибок
- [ ] **2.4** Дополнить функционал admin.routes.ts

### 🟢 СРЕДНИЕ (Приоритет 3) - Улучшения качества
- [ ] **3.1** Вынести hardcoded значения в конфигурацию
- [ ] **3.2** Добавить JSDoc комментарии
- [ ] **3.3** Настроить Swagger/OpenAPI

### 🔵 РЕКОМЕНДАЦИИ (Приоритет 4) - Архитектурные улучшения
- [ ] **4.1** Внедрить Service Layer
- [ ] **4.2** Внедрить Repository Pattern
- [ ] **4.3** Добавить Unit/Integration тесты
- [ ] **4.4** Реорганизовать файловую структуру

---

## 📊 АНАЛИЗ КОРРЕКТНОСТИ ТЗ

### ✅ Сильные стороны ТЗ:
1. **Детальный анализ** - каждая проблема описана с примерами кода
2. **Приоритизация** - проблемы разделены по критичности
3. **Конкретные решения** - для каждой проблемы есть готовый код
4. **Оценка рисков** - указаны последствия проблем
5. **Статистика** - количественные метрики рефакторинга

### ⚠️ Замечания по ТЗ:
1. **Объём работ** - некоторые задачи требуют значительного рефакторинга
2. **Зависимости** - не всегда указаны зависимости между задачами
3. **Миграции БД** - для sessions table нужна миграция
4. **Тестирование** - нет плана тестирования после изменений

### 🎯 Общий вывод:
**ТЗ корректно и может использоваться для внедрения.** Рекомендуется выполнять по приоритетам.

---

## 🔧 ДЕТАЛЬНЫЙ ПЛАН ВНЕСЕНИЯ ИЗМЕНЕНИЙ

---

## 🔴 ПРИОРИТЕТ 1: КРИТИЧЕСКИЕ ПРОБЛЕМЫ

### 1.1 Исправить LSP ошибки в support.routes.ts

**Серьёзность:** 🔴 КРИТИЧЕСКАЯ (блокирует запуск)  
**Время:** 1-2 часа  
**Сложность:** Низкая

#### Изменения:

**Файл 1: `server/storage.ts`**
```diff
+ // Добавить в интерфейс IStorage
+ getSupportConversation(userId: string): Promise<SupportConversation | undefined>;
+ createSupportMessageAttachment(attachment: InsertSupportMessageAttachment): Promise<SupportMessageAttachment>;

+ // Добавить в класс DatabaseStorage
+ async getSupportConversation(userId: string): Promise<SupportConversation | undefined> {
+   const [conversation] = await db
+     .select()
+     .from(supportConversations)
+     .where(eq(supportConversations.userId, userId))
+     .limit(1);
+   return conversation;
+ }
+ 
+ async createSupportMessageAttachment(
+   attachment: InsertSupportMessageAttachment
+ ): Promise<SupportMessageAttachment> {
+   const [newAttachment] = await db
+     .insert(supportMessageAttachments)
+     .values(attachment)
+     .returning();
+   return newAttachment;
+ }
```

**Файл 2: `server/routes/support.routes.ts`**
```diff
  router.get("/closed-search", authenticateToken, requireRole("admin", "consultant"), async (req, res) => {
    const query = req.query.q as string;
    
-   const closedConversations = await storage.searchClosedConversations(query);
+   const closedConversations = await storage.searchClosedConversations({
+     email: query,
+   });
    
    res.json(closedConversations);
  });
```

#### Проверка:
```bash
npm run check  # TypeScript должен пройти без ошибок
```

---

### 1.2 Исправить Promocode Race Condition

**Серьёзность:** 🔴 КРИТИЧЕСКАЯ (финансовые потери)  
**Время:** 3-4 часа  
**Сложность:** Высокая

#### Проблема:
Валидация промокода происходит ВНЕ транзакции → временное окно для дублирования использования промокода.

#### Решение:
Переместить ВСЮ логику промокода ВНУТРЬ транзакции с pessimistic locking.

**Файл: `server/routes/orders.routes.ts`**

Полный код замены представлен в ТЗ (строки 183-429).

Ключевые изменения:
1. Убрать валидацию промокода перед транзакцией
2. Добавить `.for('update')` для блокировки промокода
3. Выполнять всю валидацию ВНУТРИ транзакции
4. Обновить обработку ошибок

#### Тестирование:
```bash
# Необходимо протестировать race condition
# Создать concurrent запросы с одним промокодом
```

---

### 1.3 Исправить SQL Injection в WebSocket

**Серьёжность:** 🔴 КРИТИЧЕСКАЯ (безопасность)  
**Время:** 2-3 часа  
**Сложность:** Средняя

#### Проблема:
Использование raw SQL для валидации сессий в WebSocket.

#### Изменения:

**Файл 1: `shared/schema.ts`**
```diff
+ export const sessions = pgTable("session", {
+   sid: varchar("sid").primaryKey(),
+   sess: jsonb("sess").notNull(),
+   expire: timestamp("expire").notNull(),
+ });
```

**Файл 2: `server/routes.ts`**
```diff
  async function validateSessionFromCookie(cookieHeader: string | undefined) {
    // ... существующий код парсинга cookie ...
    
    const sid = unsignedValue;
    
    if (!SESSION_ID_REGEX.test(sid)) {
      logger.warn('Invalid session ID format detected', { 
        sid: sid.substring(0, 10) + '...' 
      });
      return null;
    }
    
    try {
-     const result = await db.execute(sql`SELECT sess FROM session WHERE sid = ${sid}`);
-     if (!result.rows || result.rows.length === 0) return null;
-     const sessionData = result.rows[0].sess as any;
-     if (!sessionData?.userId) return null;
      
+     const [session] = await db
+       .select()
+       .from(sessions)
+       .where(eq(sessions.sid, sid))
+       .limit(1);
+     
+     if (!session || !session.sess?.userId) return null;
+     
      return {
-       userId: sessionData.userId,
-       userRoles: sessionData.userRoles || []
+       userId: session.sess.userId,
+       userRoles: session.sess.userRoles || []
      };
    } catch (error) {
      logger.error('Session validation error', { error });
      return null;
    }
  }
```

**Файл 3: `server/db.ts`**
```diff
+ import { sessions } from '@shared/schema';
  // Экспортировать для использования
```

#### Проверка:
```bash
# WebSocket подключение должно работать без SQL ошибок
```

---

## 🟡 ПРИОРИТЕТ 2: ВЫСОКИЕ ПРОБЛЕМЫ

### 2.1 Добавить Zod валидацию

**Серьёжность:** 🟡 ВЫСОКАЯ  
**Время:** 4-6 часов  
**Сложность:** Средняя

#### Файлы для изменения:
- `shared/schema.ts` - добавить Zod схемы
- `server/routes/addresses.routes.ts` - применить валидацию
- `server/routes/payment-cards.routes.ts` - применить валидацию

#### Схемы для создания:

**`shared/schema.ts`:**
```typescript
export const createAddressSchema = z.object({
  label: z.string()
    .min(1, "Название адреса обязательно")
    .max(100, "Название слишком длинное")
    .regex(/^[а-яА-ЯёЁa-zA-Z0-9\s]+$/, "Только буквы, цифры и пробелы"),
  
  fullAddress: z.string()
    .min(10, "Полный адрес слишком короткий")
    .max(500, "Адрес слишком длинный"),
  
  city: z.string()
    .min(2, "Название города обязательно")
    .max(100, "Название города слишком длинное")
    .regex(/^[а-яА-ЯёЁ\s-]+$/, "Только русские буквы"),
  
  street: z.string()
    .min(2, "Название улицы обязательно")
    .max(200, "Название улицы слишком длинное"),
  
  building: z.string()
    .min(1, "Номер дома обязателен")
    .max(20, "Номер дома слишком длинный"),
  
  apartment: z.string()
    .max(20, "Номер квартиры слишком длинный")
    .optional(),
  
  postalCode: z.string()
    .regex(/^\d{6}$/, "Индекс должен состоять из 6 цифр"),
  
  isDefault: z.boolean().optional().default(false),
});

export const updateAddressSchema = createAddressSchema.partial();

export const createPaymentCardSchema = z.object({
  yukassaPaymentToken: z.string()
    .min(1, "Токен обязателен")
    .max(500, "Токен слишком длинный"),
  
  cardLastFour: z.string()
    .regex(/^\d{4}$/, "Последние 4 цифры карты должны быть числами"),
  
  cardType: z.enum(["visa", "mastercard", "mir", "other"], {
    errorMap: () => ({ message: "Неподдерживаемый тип карты" })
  }),
  
  isDefault: z.boolean().optional().default(false),
});

export const updatePaymentCardSchema = createPaymentCardSchema.partial();
```

#### Применение в routes:

См. детальный код в ТЗ (строки 586-620).

---

### 2.2 Создать middleware проверки владения ресурсов

**Серьёжность:** 🟡 ВЫСОКАЯ  
**Время:** 2-3 часа  
**Сложность:** Средняя

#### Создать файл: `server/middleware/resourceOwnership.ts`

```typescript
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface ResourceWithOwner {
  userId: string;
}

export function requireOwnership(
  resourceGetter: (id: string) => Promise<ResourceWithOwner | undefined>,
  resourceName: string
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resource = await resourceGetter(req.params.id);
      
      if (!resource) {
        return res.status(404).json({ 
          message: `${resourceName} не найден` 
        });
      }
      
      if (resource.userId !== req.userId) {
        logger.warn('IDOR attempt detected', {
          userId: req.userId,
          resourceId: req.params.id,
          resourceType: resourceName,
        });
        
        return res.status(404).json({ 
          message: `${resourceName} не найден` 
        });
      }
      
      next();
    } catch (error) {
      next(error);
    }
  };
}
```

#### Применить в routes:

```typescript
// server/routes/addresses.routes.ts
import { requireOwnership } from '../middleware/resourceOwnership';

router.put(
  "/:id",
  authenticateToken,
  requireOwnership(
    (id) => storage.getUserAddress(id),
    "Адрес"
  ),
  async (req, res) => {
    // ... handler code
  }
);
```

---

### 2.3 Централизовать обработку ошибок

**Серьёжность:** 🟡 ВЫСОКАЯ  
**Время:** 3-4 часа  
**Сложность:** Средняя

#### Создать файл: `server/utils/errors.ts`

```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    public message: string,
    public isOperational = true
  ) {
    super(message);
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, message);
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(404, `${resource} не найден`);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Необходима авторизация') {
    super(401, message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Доступ запрещён') {
    super(403, message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(409, message);
  }
}
```

#### Обновить: `server/middleware/errorHandler.ts`

Код представлен в ТЗ (строки 940-984).

---

### 2.4 Дополнить функционал admin.routes.ts

**Серьёжность:** 🟡 ВЫСОКАЯ  
**Время:** 6-8 часов  
**Сложность:** Средняя

#### Добавить endpoints:

1. **Управление пользователями:**
   - `PUT /api/admin/users/:id` - обновить пользователя
   
2. **Управление ролями:**
   - `POST /api/admin/users/:id/roles` - назначить роль
   - `DELETE /api/admin/users/:id/roles/:role` - удалить роль
   
3. **Управление промокодами:**
   - `GET /api/admin/promocodes` - список промокодов
   - `POST /api/admin/promocodes` - создать промокод
   - `PUT /api/admin/promocodes/:id` - обновить промокод
   - `DELETE /api/admin/promocodes/:id` - удалить промокод
   
4. **Расширенная статистика:**
   - `GET /api/admin/stats/period` - статистика по периоду

Полный код в ТЗ (строки 1013-1268).

---

## 🟢 ПРИОРИТЕТ 3: СРЕДНИЕ УЛУЧШЕНИЯ

### 3.1 Вынести hardcoded значения в конфигурацию

**Серьёжность:** 🟢 СРЕДНЯЯ  
**Время:** 2-3 часа  
**Сложность:** Низкая

#### Создать файл: `server/config/business.ts`

```typescript
export const BUSINESS_CONFIG = {
  order: {
    defaultDeliveryCost: 300,
    freeDeliveryThreshold: 3000,
    maxBonusPercent: 70,
  },
  websocket: {
    connectionLimit: 10,
    connectionWindow: 60 * 1000,
    messageLimit: 60,
    messageWindow: 60 * 1000,
  },
  bonus: {
    initialBonus: 100,
    tierThresholds: {
      basic: { min: 0, cashbackPercent: 5 },
      silver: { min: 10000, cashbackPercent: 7 },
      gold: { min: 50000, cashbackPercent: 10 },
    },
  },
} as const;
```

#### Применить в коде:

```typescript
// server/routes/orders.routes.ts
import { BUSINESS_CONFIG } from '../config/business';

const deliveryCost = subtotal >= BUSINESS_CONFIG.order.freeDeliveryThreshold
  ? 0
  : BUSINESS_CONFIG.order.defaultDeliveryCost;
```

---

### 3.2 Добавить JSDoc комментарии

**Серьёжность:** 🟢 НИЗКАЯ  
**Время:** 4-6 часов  
**Сложность:** Низкая

#### Пример:

```typescript
/**
 * Создание нового заказа
 * 
 * @route POST /api/orders
 * @access Authenticated users
 * @description Создаёт заказ, списывает товары со склада, применяет промокоды/бонусы
 * 
 * @body {CreateOrderSchema} data - Данные заказа
 * @returns {Order} Созданный заказ
 * 
 * @throws {400} VALIDATION_ERROR - Некорректные данные
 * @throws {400} INSUFFICIENT_STOCK - Недостаточно товара
 * @throws {400} PROMOCODE_EXPIRED - Промокод истёк
 * @throws {404} PRODUCT_NOT_FOUND - Товар не найден
 */
router.post("/", authenticateToken, orderLimiter, async (req, res, next) => {
  // ...
});
```

Применить ко всем endpoints во всех route файлах.

---

### 3.3 Настроить Swagger/OpenAPI

**Серьёжность:** 🟢 НИЗКАЯ  
**Время:** 6-8 часов  
**Сложность:** Средняя

#### Установить зависимости:

```bash
npm install swagger-ui-express swagger-jsdoc
npm install -D @types/swagger-ui-express @types/swagger-jsdoc
```

#### Создать файл: `server/swagger.ts`

```typescript
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EcoMarket API',
      version: '1.0.0',
      description: 'API документация для EcoMarket',
    },
    servers: [
      {
        url: process.env.NODE_ENV === 'production' 
          ? 'https://your-domain.com'
          : 'http://localhost:5000',
      },
    ],
  },
  apis: ['./server/routes/*.ts'],
};

const specs = swaggerJsdoc(options);

export { specs, swaggerUi };
```

#### Применить в `server/index.ts`:

```typescript
import { specs, swaggerUi } from './swagger';

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs));
```

---

## 🔵 ПРИОРИТЕТ 4: АРХИТЕКТУРНЫЕ УЛУЧШЕНИЯ

### 4.1 Внедрить Service Layer

**Серьёжность:** 🔵 НИЗКАЯ (улучшение архитектуры)  
**Время:** 12-16 часов  
**Сложность:** Высокая

#### Цель:
Отделить бизнес-логику от HTTP handlers.

#### Создать сервисы:
- `server/services/order.service.ts`
- `server/services/promocode.service.ts`
- `server/services/bonus.service.ts`
- `server/services/product.service.ts`

#### Пример:

```typescript
// server/services/order.service.ts
export class OrderService {
  async createOrder(userId: string, data: CreateOrderData): Promise<Order> {
    // Вся логика создания заказа из orders.routes.ts
  }
  
  async updateOrderStatus(orderId: string, status: string): Promise<Order> {
    // Логика обновления статуса
  }
  
  async getUserOrders(userId: string): Promise<Order[]> {
    return storage.getOrdersByUser(userId);
  }
}
```

#### Применить в routes:

```typescript
// server/routes/orders.routes.ts
const orderService = new OrderService();

router.post("/", authenticateToken, orderLimiter, async (req, res, next) => {
  try {
    const data = createOrderSchema.parse(req.body);
    const order = await orderService.createOrder(req.userId!, data);
    res.json(order);
  } catch (error) {
    next(error);
  }
});
```

---

### 4.2 Внедрить Repository Pattern

**Серьёжность:** 🔵 НИЗКАЯ (улучшение архитектуры)  
**Время:** 16-20 часов  
**Сложность:** Очень высокая

#### Цель:
Разбить монолитный `storage.ts` (950+ строк) на модульные репозитории.

#### Создать репозитории:
- `server/repositories/base.repository.ts`
- `server/repositories/user.repository.ts`
- `server/repositories/product.repository.ts`
- `server/repositories/order.repository.ts`
- И т.д.

#### Пример:

```typescript
// server/repositories/base.repository.ts
export abstract class BaseRepository<T, InsertT> {
  constructor(protected table: any) {}
  
  async findById(id: string): Promise<T | undefined> {
    const [result] = await db
      .select()
      .from(this.table)
      .where(eq(this.table.id, id))
      .limit(1);
    return result;
  }
  
  async findAll(options?: PaginationOptions): Promise<T[]> {
    return db.select().from(this.table);
  }
}

// server/repositories/order.repository.ts
export class OrderRepository extends BaseRepository<Order, InsertOrder> {
  constructor() {
    super(orders);
  }
  
  async findByUser(userId: string): Promise<Order[]> {
    return db
      .select()
      .from(this.table)
      .where(eq(this.table.userId, userId))
      .orderBy(desc(this.table.createdAt));
  }
}
```

---

### 4.3 Добавить Unit/Integration тесты

**Серьёжность:** 🔵 НИЗКАЯ (качество)  
**Время:** 20-30 часов  
**Сложность:** Высокая

#### Установить зависимости:

```bash
npm install -D vitest @testing-library/react @testing-library/jest-dom
npm install -D supertest @types/supertest
```

#### Создать тесты:

```typescript
// test/server/routes/orders.test.ts
describe('POST /api/orders', () => {
  it('should create order successfully', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', sessionCookie)
      .send(orderData);
    
    expect(response.status).toBe(200);
    expect(response.body).toHaveProperty('orderNumber');
  });
  
  it('should prevent promocode double spend', async () => {
    // Test race condition fix
  });
  
  it('should validate order data', async () => {
    const response = await request(app)
      .post('/api/orders')
      .set('Cookie', sessionCookie)
      .send({ invalid: 'data' });
    
    expect(response.status).toBe(400);
  });
});
```

---

### 4.4 Реорганизовать файловую структуру

**Серьёжность:** 🔵 НИЗКАЯ (организация)  
**Время:** 4-6 часов  
**Сложность:** Средняя

#### Текущая структура:
```
server/
├── routes/ (12 файлов)
├── routes.ts
├── routes.old.ts
└── storage.ts
```

#### Рекомендуемая структура:
```
server/
├── routes/ (12 файлов)
├── middleware/
│   ├── auth.ts
│   ├── rateLimiter.ts
│   ├── errorHandler.ts
│   ├── csrf.ts
│   └── resourceOwnership.ts
├── services/ (новые)
│   ├── order.service.ts
│   ├── promocode.service.ts
│   └── bonus.service.ts
├── repositories/ (новые)
│   ├── base.repository.ts
│   ├── user.repository.ts
│   ├── product.repository.ts
│   └── order.repository.ts
├── config/
│   └── business.ts
├── utils/
│   ├── errors.ts
│   ├── logger.ts
│   └── sanitize.ts
├── routes.ts (только WebSocket)
└── index.ts
```

#### Действия:
1. Создать новые директории
2. Переместить файлы
3. Обновить импорты
4. Удалить `routes.old.ts` после полного тестирования

---

## 📝 ПОРЯДОК ВЫПОЛНЕНИЯ (Рекомендуемый)

### Фаза 1: Критические исправления (1-2 дня)
1. Исправить LSP ошибки в support.routes.ts ✅
2. Исправить Promocode Race Condition ✅
3. Исправить SQL Injection в WebSocket ✅

**Проверка:** Все TypeScript ошибки устранены, приложение запускается.

---

### Фаза 2: Валидация и безопасность (3-5 дней)
4. Добавить Zod валидацию ✅
5. Создать middleware проверки владения ✅
6. Централизовать обработку ошибок ✅

**Проверка:** Все endpoints валидируют данные, IDOR защищены.

---

### Фаза 3: Функциональность (5-7 дней)
7. Дополнить функционал admin.routes.ts ✅
8. Вынести hardcoded значения ✅

**Проверка:** Админ панель полностью функциональна.

---

### Фаза 4: Документация (3-5 дней)
9. Добавить JSDoc комментарии ✅
10. Настроить Swagger/OpenAPI ✅

**Проверка:** API полностью документирован.

---

### Фаза 5: Архитектура (опционально, 2-4 недели)
11. Внедрить Service Layer ⏸️
12. Внедрить Repository Pattern ⏸️
13. Добавить тесты ⏸️
14. Реорганизовать структуру ⏸️

**Проверка:** Код модульный, покрытие тестами >70%.

---

## 🎯 ИТОГОВАЯ ОЦЕНКА

### Минимальный набор для production:
- ✅ Фаза 1: Критические исправления
- ✅ Фаза 2: Валидация и безопасность
- ⚠️ Фаза 3: Функциональность (частично)

**Срок:** 1-2 недели работы одного разработчика

### Полный набор для качественного production:
- ✅ Фазы 1-4 полностью
- ⚠️ Фаза 5 (опционально)

**Срок:** 1-1.5 месяца работы одного разработчика

---

## 📊 МЕТРИКИ УСПЕХА

### После Фазы 1:
- [ ] 0 TypeScript ошибок
- [ ] 0 критических уязвимостей безопасности
- [ ] Приложение запускается без ошибок

### После Фазы 2:
- [ ] Все endpoints валидируют входные данные
- [ ] IDOR защита на всех ресурсах пользователя
- [ ] Централизованная обработка ошибок

### После Фазы 3:
- [ ] Админ панель полностью функциональна
- [ ] Нет hardcoded значений

### После Фазы 4:
- [ ] 100% endpoints документированы
- [ ] Swagger UI доступен

### После Фазы 5 (опционально):
- [ ] Code coverage >70%
- [ ] Модульная архитектура
- [ ] Все тесты проходят

---

## ⚠️ РИСКИ И ПРЕДУПРЕЖДЕНИЯ

### Критические риски:
1. **Миграция БД для sessions** - требует осторожности
2. **Изменение логики промокодов** - нужно тестирование с concurrent запросами
3. **Рефакторинг транзакций** - риск потери данных при ошибках

### Рекомендации:
1. Делать backup БД перед каждой фазой
2. Тестировать на staging окружении
3. Развёртывать изменения поэтапно
4. Мониторить логи после каждого деплоя

---

## 📞 ПОДДЕРЖКА

При возникновении проблем при внедрении:
1. Проверить логи приложения
2. Проверить миграции БД
3. Откатиться к предыдущей версии при критических ошибках
4. Использовать `git bisect` для поиска проблемного коммита

---

**Конец плана**
