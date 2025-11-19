import { db } from "./db";
import { users, userRoles, categories, products, productImages } from "@shared/schema";
import { hashPassword } from "./auth";
import { eq } from "drizzle-orm";

async function seed() {
  console.log("🌱 Начинаем заполнение базы данных...");

  // Создание пользователей
  console.log("👥 Создаём пользователей...");
  
  const usersToCreate = [
    {
      email: "admin@ecomarket.ru",
      password: "admin123",
      firstName: "Администратор",
      lastName: "Системы",
      phone: "+79991234567",
      bonusBalance: 0,
      roles: ["admin", "customer"]
    },
    {
      email: "user1@example.com",
      password: "user123",
      firstName: "Иван",
      lastName: "Петров",
      phone: "+79001112233",
      bonusBalance: 500,
      roles: ["customer"]
    },
    {
      email: "user2@example.com", 
      password: "user123",
      firstName: "Мария",
      lastName: "Сидорова",
      phone: "+79002223344",
      bonusBalance: 750,
      roles: ["customer"]
    },
    {
      email: "user3@example.com",
      password: "user123",
      firstName: "Алексей",
      lastName: "Кузнецов",
      phone: "+79003334455",
      bonusBalance: 1000,
      roles: ["customer"]
    }
  ];

  for (const userData of usersToCreate) {
    const existingUser = await db
      .select()
      .from(users)
      .where(eq(users.email, userData.email))
      .limit(1);

    if (existingUser.length === 0) {
      const passwordHash = await hashPassword(userData.password);
      
      const [newUser] = await db
        .insert(users)
        .values({
          email: userData.email,
          passwordHash,
          firstName: userData.firstName,
          lastName: userData.lastName,
          phone: userData.phone,
          isVerified: true,
          bonusBalance: userData.bonusBalance,
        })
        .returning();

      for (const role of userData.roles) {
        await db.insert(userRoles).values({
          userId: newUser.id,
          role,
        });
      }

      console.log(`✓ Создан пользователь: ${userData.email}`);
    } else {
      console.log(`✓ Пользователь уже существует: ${userData.email}`);
    }
  }

  // Создание категорий
  const existingCategories = await db.select().from(categories).limit(1);
  
  if (existingCategories.length === 0) {
    console.log("📂 Создаём категории...");
    
    const categoryData = [
      { name: "Мёд и продукты пчеловодства", slug: "honey", description: "Натуральный мёд, прополис, пчелиная пыльца", sortOrder: 1 },
      { name: "Травяные сборы и чаи", slug: "herbs", description: "Лечебные травы и натуральные чаи", sortOrder: 2 },
      { name: "Органическая косметика", slug: "cosmetics", description: "Натуральная косметика и средства по уходу", sortOrder: 3 },
      { name: "Суперфуды", slug: "superfoods", description: "Спирулина, хлорелла, семена чиа и другие суперфуды", sortOrder: 4 },
      { name: "Масла и орехи", slug: "oils-nuts", description: "Органические масла и орехи", sortOrder: 5 },
    ];

    const createdCategories = await db.insert(categories).values(categoryData).returning();
    console.log(`✓ Создано ${createdCategories.length} категорий`);

    console.log("🛍️ Создаём 150 тестовых товаров...");
    
    const honeyCategory = createdCategories.find(c => c.slug === "honey")!;
    const herbsCategory = createdCategories.find(c => c.slug === "herbs")!;
    const cosmeticsCategory = createdCategories.find(c => c.slug === "cosmetics")!;
    const superfoodsCategory = createdCategories.find(c => c.slug === "superfoods")!;
    const oilsCategory = createdCategories.find(c => c.slug === "oils-nuts")!;

    // Генератор товаров для каждой категории (по 30 на категорию)
    const productData: any[] = [];

    // Мёд и продукты пчеловодства (30 товаров)
    const honeyTypes = ["цветочный", "гречишный", "липовый", "акациевый", "каштановый", "донниковый", "подсолнечный", "разнотравье"];
    const honeyProducts = ["Мёд", "Прополис", "Пчелиная пыльца", "Маточное молочко", "Перга"];
    
    for (let i = 1; i <= 30; i++) {
      const isHoney = i <= 24;
      const productType = isHoney ? "Мёд" : honeyProducts[i % honeyProducts.length];
      const honeyType = isHoney ? honeyTypes[i % honeyTypes.length] : "";
      const name = isHoney ? `${productType} ${honeyType} ${i > 8 ? "премиум" : ""}`.trim() : `${productType} ${i > 24 ? "органический" : "натуральный"}`;
      
      productData.push({
        categoryId: honeyCategory.id,
        sku: `HONEY-${String(i).padStart(3, '0')}`,
        name,
        description: `Натуральный ${name.toLowerCase()} высшего качества. Собран в экологически чистых районах России.`,
        composition: `100% натуральный ${productType.toLowerCase()}`,
        storageConditions: "Хранить при температуре от +4°C до +20°C в тёмном месте",
        usageInstructions: "Употреблять по 1-2 чайные ложки в день",
        contraindications: "Индивидуальная непереносимость продуктов пчеловодства",
        weight: isHoney ? "500" : ["50", "100", "20"][i % 3],
        shelfLifeDays: isHoney ? 730 : [1095, 365, 180][i % 3],
        stockQuantity: 20 + (i % 80),
        price: String(500 + (i * 50)),
        isNew: i % 5 === 0,
        discountPercentage: i % 7 === 0 ? "10" : undefined,
        discountStartDate: i % 7 === 0 ? new Date() : undefined,
        discountEndDate: i % 7 === 0 ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) : undefined,
      });
    }

    // Травяные сборы и чаи (30 товаров)
    const herbTypes = ["Иван-чай", "Ромашка", "Мята", "Мелисса", "Чабрец", "Зверобой", "Календула", "Шалфей", "Крапива", "Липа"];
    const herbCollections = ["Здоровый сон", "Иммунитет", "Детокс", "Женское здоровье", "Успокоительный", "Бодрость"];
    
    for (let i = 1; i <= 30; i++) {
      const isCollection = i % 3 === 0;
      const name = isCollection 
        ? `Сбор "${herbCollections[i % herbCollections.length]}" ${i > 15 ? "премиум" : ""}`.trim()
        : `${herbTypes[i % herbTypes.length]} ${i > 15 ? "ферментированная" : "сушеная"}`;
      
      productData.push({
        categoryId: herbsCategory.id,
        sku: `HERB-${String(i).padStart(3, '0')}`,
        name,
        description: `${name} - натуральный травяной ${isCollection ? "сбор" : "чай"} для вашего здоровья и хорошего самочувствия.`,
        composition: isCollection ? "Смесь лекарственных трав" : `${herbTypes[i % herbTypes.length]} - 100%`,
        storageConditions: "Хранить в сухом прохладном месте в герметичной упаковке",
        usageInstructions: "Заваривать 1-2 чайные ложки на 200 мл кипятка",
        contraindications: "Индивидуальная непереносимость",
        weight: ["50", "75", "100"][i % 3],
        shelfLifeDays: [365, 540, 730][i % 3],
        stockQuantity: 30 + (i % 70),
        price: String(180 + (i * 20)),
        isNew: i % 6 === 0,
        discountPercentage: i % 8 === 0 ? "15" : undefined,
        discountStartDate: i % 8 === 0 ? new Date() : undefined,
        discountEndDate: i % 8 === 0 ? new Date(Date.now() + 21 * 24 * 60 * 60 * 1000) : undefined,
      });
    }

    // Органическая косметика (30 товаров)
    const cosmeticTypes = [
      "Крем для лица", "Крем для рук", "Мыло ручной работы", "Шампунь", "Бальзам для волос",
      "Скраб для тела", "Маска для лица", "Бальзам для губ", "Зубная паста", "Дезодорант",
      "Гель для душа", "Лосьон для тела", "Масло для тела"
    ];
    const cosmeticIngredients = ["масло ши", "алоэ вера", "медом", "кокосовым маслом", "маслом арганы", "чайным деревом"];
    
    for (let i = 1; i <= 30; i++) {
      const productType = cosmeticTypes[i % cosmeticTypes.length];
      const ingredient = cosmeticIngredients[i % cosmeticIngredients.length];
      const name = `${productType} с ${ingredient}`;
      
      productData.push({
        categoryId: cosmeticsCategory.id,
        sku: `COSM-${String(i).padStart(3, '0')}`,
        name,
        description: `Натуральный ${productType.toLowerCase()} с ${ingredient}. Без парабенов и сульфатов.`,
        composition: `Органические ингредиенты, ${ingredient}`,
        storageConditions: "Хранить при температуре от +5°C до +25°C",
        usageInstructions: `Наносить на ${productType.includes("лица") || productType.includes("тела") ? "очищенную кожу" : "влажные волосы"}`,
        contraindications: "Индивидуальная непереносимость компонентов",
        weight: productType.includes("Крем") || productType.includes("Маска") ? ["50", "100"][i % 2] : undefined,
        volume: productType.includes("Шампунь") || productType.includes("Гель") || productType.includes("Лосьон") ? ["250", "500"][i % 2] : 
                productType.includes("паста") ? "75" : 
                productType.includes("Мыло") ? undefined : ["30", "50"][i % 2],
        shelfLifeDays: [180, 365, 730][i % 3],
        stockQuantity: 25 + (i % 75),
        price: String(250 + (i * 35)),
        isNew: i % 4 === 0,
        discountPercentage: i % 9 === 0 ? "20" : undefined,
        discountStartDate: i % 9 === 0 ? new Date() : undefined,
        discountEndDate: i % 9 === 0 ? new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) : undefined,
      });
    }

    // Суперфуды (30 товаров)
    const superfoodTypes = [
      "Спирулина", "Хлорелла", "Семена чиа", "Ягоды годжи", "Какао-бобы", "Киноа",
      "Семена льна", "Асаи порошок", "Матча", "Ягоды асаи", "Мака перуанская",
      "Семена конопли", "Кунжут", "Амарант"
    ];
    const superfoodForms = ["порошок", "таблетки", "органические", "сушеные", "сырые"];
    
    for (let i = 1; i <= 30; i++) {
      const superfood = superfoodTypes[i % superfoodTypes.length];
      const form = superfoodForms[i % superfoodForms.length];
      const name = `${superfood} ${form}`;
      
      productData.push({
        categoryId: superfoodsCategory.id,
        sku: `SUPER-${String(i).padStart(3, '0')}`,
        name,
        description: `${name} - природный источник витаминов, минералов и антиоксидантов для вашего здоровья.`,
        composition: `${superfood} - 100%`,
        storageConditions: "Хранить в сухом прохладном месте, вдали от солнечных лучей",
        usageInstructions: form === "таблетки" ? "Принимать по 3-6 таблеток в день" : "Добавлять 1-2 чайные ложки в смузи, йогурты или каши",
        contraindications: "Беременность, лактация, индивидуальная непереносимость",
        weight: ["100", "200", "250", "300"][i % 4],
        shelfLifeDays: [365, 730][i % 2],
        stockQuantity: 15 + (i % 85),
        price: String(450 + (i * 60)),
        isNew: i % 3 === 0,
        discountPercentage: i % 6 === 0 ? "15" : undefined,
        discountStartDate: i % 6 === 0 ? new Date() : undefined,
        discountEndDate: i % 6 === 0 ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) : undefined,
      });
    }

    // Масла и орехи (30 товаров)
    const oilTypes = ["кокосовое", "льняное", "оливковое", "кунжутное", "тыквенное", "облепиховое", "кедровое", "горчичное"];
    const nutTypes = ["миндаль", "грецкий орех", "кешью", "фундук", "бразильский орех", "пекан", "макадамия", "кедровые орехи"];
    
    for (let i = 1; i <= 30; i++) {
      const isOil = i % 2 === 0;
      const productType = isOil ? oilTypes[i % oilTypes.length] : nutTypes[i % nutTypes.length];
      const name = isOil 
        ? `Масло ${productType} ${i > 15 ? "virgin" : "холодного отжима"}`
        : `${productType} ${i > 15 ? "очищенные" : "сырые"}`;
      
      productData.push({
        categoryId: oilsCategory.id,
        sku: `${isOil ? "OIL" : "NUT"}-${String(i).padStart(3, '0')}`,
        name,
        description: `${name} - источник полезных жиров, витаминов и минералов. Высшее качество.`,
        composition: `${name} - 100%`,
        storageConditions: isOil ? "Хранить в тёмном прохладном месте" : "Хранить в сухом прохладном месте",
        usageInstructions: isOil ? "Использовать для салатов и холодных блюд" : "Употреблять как снек или добавлять в блюда",
        contraindications: isOil ? "Индивидуальная непереносимость" : "Аллергия на орехи",
        weight: isOil ? undefined : ["200", "250", "500"][i % 3],
        volume: isOil ? ["250", "500"][i % 2] : undefined,
        shelfLifeDays: isOil ? [180, 540][i % 2] : [180, 365][i % 2],
        stockQuantity: 30 + (i % 70),
        price: String(380 + (i * 45)),
        isNew: i % 5 === 0,
        discountPercentage: i % 10 === 0 ? "12" : undefined,
        discountStartDate: i % 10 === 0 ? new Date() : undefined,
        discountEndDate: i % 10 === 0 ? new Date(Date.now() + 15 * 24 * 60 * 60 * 1000) : undefined,
      });
    }

    const createdProducts = await db.insert(products).values(productData).returning();
    console.log(`✓ Создано ${createdProducts.length} товаров`);
    console.log("ℹ️  Товары созданы без изображений. Добавьте фото через админ панель.");
  } else {
    console.log("✓ Категории и товары уже существуют");
  }

  console.log("✅ База данных успешно заполнена!");
  console.log("\n📊 Итого создано:");
  console.log("   - Пользователей: 4 (admin + user1, user2, user3)");
  console.log("   - Категорий: 5");
  console.log("   - Товаров: 150 (по 30 на категорию)");
}

seed()
  .catch((error) => {
    console.error("❌ Ошибка при заполнении базы данных:", error);
    process.exit(1);
  })
  .then(() => {
    console.log("👋 Готово!");
    process.exit(0);
  });
