- `WHERE` - фильтрует в исходной таблице из таблицы
- `HAVING` - фильтрует из таблицы которая получилась после запроса

```sql
SELECT city, count(*), max(temp_lo)
FROM weather
WHERE city ilike '%gogol%'
GROUP BY city
HAVING max(temp_lo) < 40
ORDER BY 2 DESC
```
