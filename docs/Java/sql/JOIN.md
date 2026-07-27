# JOIN

`JOIN` — сокращение от `INNER JOIN` (внутреннее соединение), покажет только пересекающиеся записи.

```sql
SELECT t1.col1, t1.col2, t2.col3
FROM table1 AS t1
JOIN table2 ON t1.id = table2.id;
```

## OUTER JOIN

`OUTER JOIN` (внешнее соединение) может быть:

- `LEFT`;
- `RIGHT`;
- `FULL`.

`LEFT` возьмёт всю левую таблицу и добавит только пересечения правой. Там, где нет пересечений, — `NULL`.

`RIGHT` сделает наоборот.

`FULL` покажет всё. Чтобы нормально увидеть пересечения, нужно сделать `ORDER` или убрать `NULL`, используя `WHERE`.

Также, используя `LEFT JOIN` с `WHERE IS NULL`, можно увидеть, где нет пересечений.

## Сокращения

- `INNER JOIN == JOIN`
- `FULL OUTER JOIN == FULL JOIN`
- `LEFT OUTER JOIN == LEFT JOIN`

![joins.jpg](joins.jpg)
