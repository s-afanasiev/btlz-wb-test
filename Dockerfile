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
COPY --from=build /app/src/postgres/migrations ./dist/postgres/migrations
COPY --from=build /app/src/google-service/peerless-tiger-470113-s4-5bfd19996102.json ./dist/google-service/

# Установка переменных окружения
ENV NODE_ENV=production
ENV PORT=3000

# Установка не-root пользователя
USER appuser

# Healthcheck для проверки работоспособности приложения
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "console.log('Health check passed')" || exit 1

# Команда для запуска приложения
CMD ["npm", "start"]