//@ts-nocheck
import axios from 'axios';

class WildberriesAPI {
  constructor(apiToken) {
    this.apiToken = apiToken;
    this.baseURL = 'https://common-api.wildberries.ru';
    this.lastRequestTime = 0;
    this.rateLimitDelay = 1000; // 1 секунда между запросами (лимит WB)
  }

  /**
   * Ожидание для соблюдения rate limit
   */
  async waitForRateLimit() {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.rateLimitDelay) {
      const waitTime = this.rateLimitDelay - timeSinceLastRequest;
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    
    this.lastRequestTime = Date.now();
  }

  /**
   * Получение тарифов коробов от WB API
   * @param {string} date - Дата в формате ГГГГ-ММ-ДД (опционально)
   * @returns {Promise<Array>} Массив тарифов по складам
   */
  async fetchBoxTariffs(date = null) {
    if (!this.apiToken) {
      throw new Error('WB API token not configured');
    }

    await this.waitForRateLimit();

    try {
      console.log('🚀 Запрашиваем тарифы коробов от WB API...');
      // Формируем параметры запроса
      const params = {};
      if (date) {
        params.date = date;
        console.log(`📅 Запрашиваем тарифы на дату: ${date}`);
      }
      const response = await axios.get(`${this.baseURL}/api/v1/tariffs/box`, {
        params,
        headers: {
          'Authorization': this.apiToken, // WB использует простой токен, не Bearer
          'Content-Type': 'application/json',
          'User-Agent': 'WB-Tariffs-App/1.0.0'
        },
        timeout: 30000
      });
      /**
       * {
            boxDeliveryBase: '169,1',
            boxDeliveryCoefExpr: '445',
            boxDeliveryLiter: '42,28',
            boxDeliveryMarketplaceBase: '83,6',
            boxDeliveryMarketplaceCoefExpr: '220',
            boxDeliveryMarketplaceLiter: '20,9',
            boxStorageBase: '0,29',
            boxStorageCoefExpr: '415',
            boxStorageLiter: '0,29',
            geoName: 'Сибирский федеральный округ',
            warehouseName: 'Новосибирск'
        },
       */
      console.log(`✅ Получено ${response.data.response.data.warehouseList.length || 0} тарифных записей`);
      return response.data.response.data.warehouseList;
    } catch (error) {
      console.error('❌ Ошибка при получении тарифов:', error.message);
      
      if (error.response) {
        console.error('Статус ответа:', error.response.status);
        console.error('Данные ошибки:', error.response.data);
      }
      
      throw error;
    }
  }

  /**
   * Преобразование данных API в удобный формат
   * @param {Array} apiData - Сырые данные от API
   * @returns {Array} Преобразованные данные
   */
  transformTariffData(apiData) {
    return apiData.map(tariff => ({
      warehouseName: tariff.warehouseName,
      boxDeliveryAndStorageExpr: tariff.boxDeliveryAndStorageExpr,
      boxDeliveryBase: tariff.boxDeliveryBase,
      boxDeliveryLiter: tariff.boxDeliveryLiter,
      boxStorageBase: tariff.boxStorageBase,
      boxStorageLiter: tariff.boxStorageLiter,
      boxReturnBase: tariff.boxReturnBase,
      boxReturnLiter: tariff.boxReturnLiter,
      coefficient: tariff.coefficient,
      // Добавляем вычисляемые поля для удобства
      updatedAt: new Date().toISOString()
    }));
  }

  /**
   * Получение тарифов с повторными попытками
   * @param {string} date - Дата в формате ГГГГ-ММ-ДД (опционально)
   * @param {number} maxRetries - Максимум попыток
   * @returns {Promise<Array>} Массив тарифов
   */
  async fetchBoxTariffsWithRetry(date = null, maxRetries = 3) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Попытка ${attempt}/${maxRetries}`);
        return await this.fetchBoxTariffs(date);
      } catch (error) {
        lastError = error;
        console.error(`❌ Попытка ${attempt} неудачна:`, error.message);
        
        if (attempt < maxRetries) {
          const backoffTime = attempt * 2000; // Увеличиваем задержку
          console.log(`⏳ Ожидание ${backoffTime/1000} сек. до следующей попытки...`);
          await new Promise(resolve => setTimeout(resolve, backoffTime));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Расчет стоимости логистики для товара
   * @param {string} warehouseName - Название склада
   * @param {number} volumeInLiters - Объём товара в литрах
   * @returns {Object} Рассчитанные стоимости
   */
  calculateLogisticsCosts(tariffs, warehouseName, volumeInLiters = 1) {
    const tariff = tariffs.find(t => t.warehouseName === warehouseName);
    
    if (!tariff) {
      throw new Error(`Тариф для склада "${warehouseName}" не найден`);
    }

    return {
      warehouse: warehouseName,
      volume: volumeInLiters,
      deliveryCost: tariff.boxDeliveryBase + (volumeInLiters * tariff.boxDeliveryLiter),
      storageCost: tariff.boxStorageBase + (volumeInLiters * tariff.boxStorageLiter),
      returnCost: tariff.boxReturnBase + (volumeInLiters * tariff.boxReturnLiter),
      expressCost: tariff.boxDeliveryAndStorageExpr,
      coefficient: tariff.coefficient,
      totalBasicCost: function() {
        return this.deliveryCost + this.storageCost;
      }
    };
  }
}

// Пример использования
async function main() {
  // Инициализация API клиента
  const token = process.env.WB_API_TOKEN;
  const wbAPI = new WildberriesAPI(token);
  
  try {
    // Получаем актуальные тарифы
    const tariffs = await wbAPI.fetchBoxTariffsWithRetry();
    
    console.log('\n📊 Получены тарифы для складов:');
    tariffs.forEach(tariff => {
      console.log(`- ${tariff.warehouseName}: доставка от ${tariff.boxDeliveryBase}₽`);
    });

    // Пример расчета стоимости логистики
    console.log('\n💰 Пример расчета для товара объёмом 2 литра:');
    const costs = wbAPI.calculateLogisticsCosts(tariffs, 'Москва', 2);
    console.log(`Склад: ${costs.warehouse}`);
    console.log(`Доставка: ${costs.deliveryCost}₽`);
    console.log(`Хранение: ${costs.storageCost}₽`);
    console.log(`Возврат: ${costs.returnCost}₽`);
    console.log(`Общая стоимость: ${costs.totalBasicCost()}₽`);

  } catch (error) {
    console.error('💥 Критическая ошибка:', error.message);
  }
}

// Настройка ежечасного получения данных
function setupHourlyUpdates() {
  const wbAPI = new WildberriesAPI(process.env.WB_API_TOKEN);
  
  setInterval(async () => {
    console.log('\n⏰ Ежечасное обновление тарифов...');
    try {
      const tariffs = await wbAPI.fetchBoxTariffsWithRetry();
      
      // Здесь можно сохранить в БД, отправить уведомления и т.д.
      console.log(`✅ Обновлено ${tariffs.length} тарифов в ${new Date().toLocaleString()}`);
      
    } catch (error) {
      console.error('❌ Ошибка при ежечасном обновлении:', error.message);
    }
  }, 60 * 60 * 1000); // Каждый час
}

// Экспорт для использования в других модулях
export default WildberriesAPI;

// Запуск примера (раскомментируйте для тестирования)
// main();
// setupHourlyUpdates();