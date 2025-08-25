# Шпаргалка по созданию оптимизированного Dockerfile для Node.js с Multi-Stage Builds

Эта шпаргалка объясняет структуру многоэтапного (multi-stage) Dockerfile для Node.js приложений, включая использование флагов `npm`, таких как `--omit=dev` и `--include=dev`, и рекомендации по оптимизации.

## 1. Общая структура Dockerfile

Многоэтапные сборки (multi-stage builds) позволяют создавать компактные Docker-образы, исключая ненужные файлы (например, `devDependencies` или исходный код) из финального образа. Ваш Dockerfile разбит на три этапа:

1. **deps-prod**: Установка только продакшн-зависимостей.
2. **build**: Сборка приложения с использованием dev-зависимостей.
3. **prod**: Финальный образ с минимальным набором файлов для продакшн.

### Пример Dockerfile
```dockerfile
# Этап 1: Установка продакшн-зависимостей
FROM node:20-alpine AS deps-prod
WORKDIR /app
COPY package*.json .
RUN npm ci --omit=dev

# Этап 2: Сборка приложения
FROM deps-prod AS build
RUN npm ci --include=dev
COPY . .
RUN npm run build

# Этап 3: Финальный продакшн-образ
FROM node:20-alpine AS prod
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
WORKDIR /app
COPY --from=build /app/package*.json .
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
ENV NODE_ENV=production
USER appuser
CMD ["npm", "start"]
```

## 2. Разбор этапов и инструкции `FROM`

Каждый `FROM` начинает новый этап сборки (stage). Это как временный "мини-образ", который используется для генерации артефактов (зависимости, скомпилированный код). Финальный образ содержит только то, что нужно для продакшн.

- **Этап `deps-prod`**:
  - **Цель**: Установить только продакшн-зависимости (`dependencies` из `package.json`).
  - **Зачем?** Ми Rosy: минимизировать размер `node_modules`, исключив `devDependencies`.
  - **Команды**:
    - `COPY package*.json .`: Копирует `package.json` и `package-lock.json`.
    - `RUN npm ci --omit=dev`: Устанавливает только продакшн-зависимости.
  - **Результат**: Папка `/app/node_modules` с минимальным набором зависимостей.

- **Этап `build`**:
  - **Цель**: Собрать приложение, используя dev-зависимости.
  - **Зачем?** Для выполнения компиляции (например, TypeScript, Webpack), которая требует инструментов из `devDependencies`.
  - **Команды**:
    - `FROM deps-prod`: Наследует продакшн-зависимости.
    - `RUN npm ci --include=dev`: Добавляет dev-зависимости.
    - `COPY . .`: Копирует весь код.
    - `RUN npm run build`: Создаёт папку `dist` с скомпилированным кодом.
  - **Результат**: Папка `dist` с готовым кодом.

- **Этап `prod`**:
  - **Цель**: Создать минимальный образ для продакшн.
  - **Зачем?** Содержит только необходимые файлы: `node_modules` (из `deps-prod`), `dist` (из `build`) и `package*.json`.
  - **Команды**:
    - `COPY --from=...`: Копирует только нужные файлы из предыдущих этапов.
    - `ENV NODE_ENV=production`: Оптимизирует работу Node.js.
    - `USER appuser`: Запускает контейнер от имени не-root пользователя.
    - `CMD ["npm", "start"]`: Задаёт команду запуска приложения.
  - **Результат**: Компактный образ для продакшн.

### Как работает `FROM`?
- Каждый `FROM` создаёт новый промежуточный образ.
- `COPY --from=stage_name` позволяет брать файлы из предыдущих этапов.
- Только последний этап становится финальным образом (остальные — временные, чистятся через `docker image prune`).

## 3. Флаги `npm`: `--omit=dev` и `--include=dev`

Эти флаги — стандартные для `npm` (начиная с версии 7), они управляют установкой зависимостей из `package.json`.

- **`--omit=dev`**:
  - Исключает `devDependencies`, устанавливает только `dependencies`.
  - Используется в `deps-prod` для минимизации размера `node_modules`.
  - Эквивалент: `--production` или `NODE_ENV=production`.

- **`--include=dev`**:
  - Устанавливает `devDependencies` (в дополнение к `dependencies`).
  - Используется в `build` для инструментов сборки (например, TypeScript, Webpack).

- **Рекомендация**: Используйте `npm ci` вместо `npm install` для строгой установки по `package-lock.json`.

## 4. Рекомендации по оптимизации

1. **Создайте `.dockerignore`**:
   - Исключите ненужные файлы (`node_modules`, `.git`, `*.md`, `.env`) для ускорения копирования и уменьшения размера образа.
   - Пример `.dockerignore`:
     ```
     node_modules
     .git
     .gitignore
     *.md
     .env
     ```

2. **Безопасность**:
   - Добавьте не-root пользователя:
     ```dockerfile
     RUN addgroup -S appgroup && adduser -S appuser -G appgroup
     USER appuser
     ```
   - Это снижает риски уязвимостей.

3. **Проверка работоспособности**:
   - Добавьте `HEALTHCHECK` для мониторинга (например, для веб-сервера):
     ```dockerfile
     HEALTHCHECK --interval=30s --timeout=3s CMD curl --fail http://localhost:3000 || exit 1
     ```

4. **Переменные окружения**:
   - Укажите `ENV NODE_ENV=production` для оптимизации Node.js.

5. **Проверка `package.json`**:
   - Убедитесь, что зависимости правильно разделены на `dependencies` и `devDependencies`.
   - Проверьте, что `npm run build` создаёт `dist`, а `npm start` запускает приложение.

## 5. Проверка и тестирование

- **Сборка**: `docker build -t my-app .`
- **Тест этапа сборки**: `docker build --target=build -t my-build .`
- **Запуск**: `docker run -p 3000:3000 my-app`
- **Чистка промежуточных образов**: `docker image prune`

## 6. Примечания

- Убедитесь, что `package-lock.json` присутствует для воспроизводимости.
- Проверьте, что папка `dist` создаётся корректно.
- Используйте точную версию образа, например, `node:20.12.2-alpine`, для стабильности.