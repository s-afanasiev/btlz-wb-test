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

# Создание не-root пользователя
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Копирование необходимых файлов
COPY --from=build /app/package*.json .
COPY --from=deps-prod /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist

# Установка переменной окружения
ENV NODE_ENV=production

# Установка не-root пользователя
USER appuser

# Команда для запуска приложения
CMD ["npm", "start"]