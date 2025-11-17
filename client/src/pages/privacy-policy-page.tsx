import { Header } from "@/components/header"

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl font-bold mb-8">Политика конфиденциальности</h1>
          
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Общие положения</h2>
              <p className="text-muted-foreground mb-4">
                Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных 
                пользователей интернет-магазина ЭкоМаркет (далее - "Сайт").
              </p>
              <p className="text-muted-foreground">
                Используя Сайт, вы соглашаетесь с условиями настоящей Политики конфиденциальности.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Собираемая информация</h2>
              <p className="text-muted-foreground mb-4">
                Мы собираем следующую информацию:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Имя, фамилия, отчество</li>
                <li>Адрес электронной почты</li>
                <li>Номер телефона</li>
                <li>Адрес доставки</li>
                <li>История заказов</li>
                <li>Информация о взаимодействии с Сайтом</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. Использование информации</h2>
              <p className="text-muted-foreground mb-4">
                Собранная информация используется для:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Обработки и выполнения заказов</li>
                <li>Связи с клиентами</li>
                <li>Улучшения качества обслуживания</li>
                <li>Персонализации предложений</li>
                <li>Рассылки информационных сообщений (с вашего согласия)</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Защита данных</h2>
              <p className="text-muted-foreground mb-4">
                Мы применяем современные технические и организационные меры для защиты ваших персональных данных 
                от несанкционированного доступа, изменения, раскрытия или уничтожения.
              </p>
              <p className="text-muted-foreground">
                Все данные передаются по защищённому протоколу HTTPS.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Передача данных третьим лицам</h2>
              <p className="text-muted-foreground mb-4">
                Мы не передаём ваши персональные данные третьим лицам, за исключением случаев:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>С вашего явного согласия</li>
                <li>Службам доставки (для выполнения заказа)</li>
                <li>Платёжным системам (для обработки платежей)</li>
                <li>По требованию закона</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Cookies</h2>
              <p className="text-muted-foreground">
                Сайт использует файлы cookie для улучшения пользовательского опыта и аналитики. 
                Вы можете отключить cookie в настройках браузера, но это может ограничить функциональность Сайта.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Ваши права</h2>
              <p className="text-muted-foreground mb-4">
                Вы имеете право:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>Запросить доступ к вашим персональным данным</li>
                <li>Исправить неточные данные</li>
                <li>Удалить свои данные</li>
                <li>Отозвать согласие на обработку данных</li>
                <li>Ограничить обработку данных</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Контакты</h2>
              <p className="text-muted-foreground mb-4">
                По вопросам, связанным с обработкой персональных данных, вы можете обратиться:
              </p>
              <p className="text-muted-foreground">
                Email: privacy@ecomarket.ru<br />
                Телефон: +7 (800) 555-35-35
              </p>
            </section>

            <section>
              <h2 className="text-2xl font-semibold mb-4">9. Изменения в Политике</h2>
              <p className="text-muted-foreground">
                Мы оставляем за собой право вносить изменения в настоящую Политику конфиденциальности. 
                Актуальная версия всегда доступна на этой странице.
              </p>
              <p className="text-muted-foreground mt-4">
                <strong>Дата последнего обновления:</strong> 17 ноября 2025 года
              </p>
            </section>
          </div>
        </div>
      </main>
    </div>
  )
}
