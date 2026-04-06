# @Transactional в Java (Spring)

## Зачем нужна аннотация

`@Transactional` управляет границами транзакции вокруг метода или класса.

Что это даёт:

1. Гарантию атомарности: либо все изменения в БД фиксируются, либо все откатываются.
2. Удобный rollback по исключениям.
3. Единый способ задать политику транзакции на уровне бизнес-логики.

## Как это работает под капотом: Proxy и CGLIB

Spring обычно применяет `@Transactional` через AOP-прокси.

Варианты прокси:

1. `JDK Dynamic Proxy` (интерфейсный прокси): используется, когда бин реализует интерфейс.
2. `CGLIB Proxy` (наследование от класса): используется, когда проксируется класс (или включён `proxyTargetClass=true`).

Ключевое ограничение обоих подходов:

- перехватываются только внешние вызовы через прокси;
- вызов метода из метода того же класса (`self-invocation`) идёт напрямую, мимо прокси.

Практические последствия:

1. `private` методы не участвуют в прокси-транзакциях.
2. Для CGLIB `final` класс/метод нельзя корректно проксировать для транзакций.
3. Если `@Transactional` стоит на методе, но метод вызывается внутри того же объекта напрямую, настройки аннотации не
   сработают как отдельный advice.

## Важные параметры `@Transactional`

Часто используемые настройки:

1. `propagation`

- `REQUIRED` (по умолчанию): присоединиться к текущей транзакции или создать новую, если её нет.
- `REQUIRES_NEW`: всегда начать новую транзакцию (текущую приостановить).
- `NESTED`: вложенная транзакция через savepoint (если поддерживается менеджером транзакций).
- Также есть `SUPPORTS`, `MANDATORY`, `NOT_SUPPORTED`, `NEVER`.

2. `isolation`

- Уровень изоляции: `READ_COMMITTED`, `REPEATABLE_READ`, `SERIALIZABLE` и др.
- Влияет на грязные/неповторяемые/фантомные чтения.

3. `timeout`

- Максимальное время транзакции в секундах.

4. `readOnly`

- Подсказка для инфраструктуры, что транзакция только на чтение.
- Может дать оптимизации, но не является универсальной защитой от записи.

5. `rollbackFor` / `noRollbackFor`

- Явно задают, при каких исключениях делать rollback или не делать.
- По умолчанию rollback идёт для `RuntimeException` и `Error`.

6. `transactionManager` (или `value`)

- Выбор конкретного `PlatformTransactionManager`, если их несколько.

7. `label`

- Метки транзакций для диагностики/наблюдаемости (если используется в вашей версии Spring и инфраструктуре).

## Другие способы управления транзакциями

Помимо `@Transactional` (декларативного подхода) есть программное управление.

1. `TransactionTemplate`

- Удобный способ обернуть конкретный кусок кода в транзакцию без AOP-прокси.
- Полезно, когда нужна точная граница транзакции внутри одного метода.
- Подходит для случаев, где важно избежать проблем `self-invocation`.

Пример:

```java
transactionTemplate.execute(status ->{
        jdbcTemplate.

update("update account set balance = balance - 100 where id = ?",fromId);
    jdbcTemplate.

update("update account set balance = balance + 100 where id = ?",toId);
    return null;
            });
```

2. `PlatformTransactionManager` (ручное управление)

- Самый низкий уровень в Spring для begin/commit/rollback.
- Даёт полный контроль, но код становится более многословным.

Пример:

```java
TransactionStatus status = txManager.getTransaction(new DefaultTransactionDefinition());
try{
        // бизнес-логика
        txManager.

commit(status);
}catch(
Exception ex){
        txManager.

rollback(status);
    throw ex;
}
```

3. `JdbcTemplate`

- `JdbcTemplate` сам по себе не является менеджером транзакций.
- Он упрощает работу с JDBC (query/update, обработка ресурсов и исключений).
- В транзакциях участвует через `DataSource` и `DataSourceTransactionManager`: если транзакция уже открыта,
  `JdbcTemplate` использует тот же connection.
- То есть обычно комбинация такая: `@Transactional` или `TransactionTemplate` + `JdbcTemplate` внутри.

4. Реактивный вариант: `TransactionalOperator` (R2DBC/WebFlux)

- Аналог `TransactionTemplate` для реактивного стека.
- Используется с `ReactiveTransactionManager`.

5. JTA/XA-транзакции

- Нужны, когда одна транзакция охватывает несколько ресурсов (например, две БД, БД + JMS).
- В Spring для этого применяют `JtaTransactionManager`.
- Более сложны в настройке, используют только когда действительно нужны распределённые транзакции.

Короткое правило выбора:

1. По умолчанию: `@Transactional`.
2. Нужна точная ручная граница в конкретном месте: `TransactionTemplate`.
3. Реактивный стек: `TransactionalOperator`.
4. Несколько ресурсов в одной транзакции: JTA/XA.

## Частые ошибки

1. Ожидание, что внутренний вызов метода в том же классе создаст новую транзакцию.
2. Использование `@Transactional` на `private` методах.
3. Ожидание rollback для checked-исключений без настройки `rollbackFor`.

## Задача и ответ

Задача:

```java
class Trans {

    @Transactional
    public void doIt() {
    }

    @Transactional
    public void doItIt() {
        doIt();
    }
}
```

Вопрос: будет ли вызов `doIt()` открывать вторую транзакцию?

Ответ: **нет, не будет** (в типичной proxy-модели Spring).

Почему:

1. Вызов `doIt()` из `doItIt()` внутри того же класса идёт как `this.doIt()`, то есть мимо прокси.
2. Поэтому отдельная логика `@Transactional` для `doIt()` не применяется как отдельный перехват.
3. В результате работает одна транзакция, начатая на входе в `doItIt()` (при `propagation = REQUIRED`).

Когда могла бы появиться отдельная транзакция:

1. Если вызов `doIt()` идёт через прокси (из другого бина или через self-proxy).
2. И для `doIt()` задано `propagation = REQUIRES_NEW`.

## Полезная статья

- [Статья](https://habr.com/ru/articles/682362/)
