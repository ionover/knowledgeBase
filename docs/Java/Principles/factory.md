# Фабрика

Фабрика — это порождающий шаблон проектирования, который отвечает за создание объектов. Клиент запрашивает объект у фабрики, а фабрика решает, экземпляр какого конкретного класса нужно создать.

Клиент при этом зависит не от конкретного класса, а от общего интерфейса или абстрактного класса. Это позволяет выбирать реализацию во время выполнения программы и не размещать логику создания объектов во всех местах, где они используются.

## Связь с наследованием и полиморфизмом

Разные классы реализуют общий интерфейс или наследуются от одного абстрактного класса. Так появляется единый тип, с которым может работать клиент.

Фабрика возвращает этот общий тип, но внутри создаёт конкретную реализацию:

```java
interface Notification {
    void send(String message);
}

class EmailNotification implements Notification {
    @Override
    public void send(String message) {
        System.out.println("Email: " + message);
    }
}

class SmsNotification implements Notification {
    @Override
    public void send(String message) {
        System.out.println("SMS: " + message);
    }
}

class NotificationFactory {
    public Notification create(String type) {
        return switch (type) {
            case "email" -> new EmailNotification();
            case "sms" -> new SmsNotification();
            default -> throw new IllegalArgumentException("Unknown type: " + type);
        };
    }
}
```

Клиент использует объект через интерфейс `Notification`:

```java
NotificationFactory factory = new NotificationFactory();
Notification notification = factory.create("email");
notification.send("Hello");
```

В переменной находится ссылка типа `Notification`, но фактический объект может быть `EmailNotification` или `SmsNotification`. При вызове `send()` Java выбирает реализацию метода конкретного объекта. Это и есть полиморфизм.

Наследование или реализация интерфейса создаёт общую иерархию типов. Полиморфизм позволяет одинаково работать с разными реализациями. Фабрика отвечает за выбор и создание нужной реализации.
