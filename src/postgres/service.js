//@ts-nocheck
class PgService {
    constructor(knex) {
        this.knex = knex;
    }
    /**
     * Сохранение данных от Wildberries API в базу данных
     * @param {Object} wbData - данные от Wildberries
     */
    async saveWbDataToDB(wbData) {
        const start = new Date().getTime();
        const trx = await this.knex.transaction();
        try {
            // 1. Создаем запись в tariff_requests
            const [tariffRequest] = await trx('tariff_requests')
            .insert({
                dt_next_box: wbData.dtNextBox || null,
                dt_till_max: wbData.dtTillMax,
                request_dt: new Date() // текущее время
            })
            .returning('id');
            const tariffRequestId = tariffRequest.id;
            // 2. Обрабатываем каждый склад
            for (const warehouse of wbData.warehouseList) {
                // 2.1. Ищем или создаем запись склада
                let warehouseRecord = await trx('warehouses')
                    .where({
                    wb_warehouse_name: warehouse.warehouseName,
                    geo_name: warehouse.geoName
                    })
                    .first();
                if (!warehouseRecord) {
                    // Создаем новый склад если не существует
                    [warehouseRecord] = await trx('warehouses')
                    .insert({
                        wb_warehouse_name: warehouse.warehouseName,
                        geo_name: warehouse.geoName
                    })
                    .returning(['id']);
                }
                // 2.2. Создаем запись тарифа
                await trx('tariffs').insert({
                    tariff_request_id: tariffRequestId,
                    warehouse_id: warehouseRecord.id,
                    box_delivery_base: warehouse.boxDeliveryBase,
                    box_delivery_coef_expr: warehouse.boxDeliveryCoefExpr,
                    box_delivery_liter: warehouse.boxDeliveryLiter,
                    box_delivery_marketplace_base: warehouse.boxDeliveryMarketplaceBase,
                    box_delivery_marketplace_coef_expr: warehouse.boxDeliveryMarketplaceCoefExpr,
                    box_delivery_marketplace_liter: warehouse.boxDeliveryMarketplaceLiter,
                    box_storage_base: warehouse.boxStorageBase,
                    box_storage_coef_expr: warehouse.boxStorageCoefExpr,
                    box_storage_liter: warehouse.boxStorageLiter
                });
            }
            await trx.commit();
            const end = new Date().getTime();
            console.log(`Сохранен запрос тарифов с ID: ${tariffRequestId}, Время: ${end-start}`);
            return tariffRequestId;
        } catch (error) {
            await trx.rollback();
            console.error('Ошибка при сохранении данных:', error);
            throw error;
        }
    }

    /**
     * Альтернативный вариант с пакетной вставкой для лучшей производительности
     */
    async saveWbDataToDBBatch(wbData) {
        const trx = await this.knex.transaction();
        try {
            // 1. Создаем запись в tariff_requests
            const [tariffRequest] = await trx('tariff_requests')
                .insert({
                    dt_next_box: wbData.dtNextBox || null,
                    dt_till_max: wbData.dtTillMax || null,
                    request_dt: new Date()
                })
                .returning('id');
            const tariffRequestId = tariffRequest.id;
            // 2. Подготавливаем данные складов для пакетной вставки
            const warehousesToInsert = [];
            const existingWarehouses = new Map();
            // 2.1. Получаем все существующие склады одним запросом
            const existingWarehouseRecords = await trx('warehouses').select('*');
            existingWarehouseRecords.forEach(wh => {
                const key = `${wh.wb_warehouse_name}|${wh.geo_name}`;
                existingWarehouses.set(key, wh);
            });
            // 2.2. Определяем какие склады нужно создать
            for (const warehouse of wbData.warehouseList) {
                const key = `${warehouse.warehouseName}|${warehouse.geoName}`;
                if (!existingWarehouses.has(key)) {
                    warehousesToInsert.push({
                    wb_warehouse_name: warehouse.warehouseName,
                    geo_name: warehouse.geoName
                    });
                }
            }
            // 2.3. Создаем новые склады пакетно
            let newWarehouses = [];
            if (warehousesToInsert.length > 0) {
                newWarehouses = await trx('warehouses')
                    .insert(warehousesToInsert)
                    .returning(['id', 'wb_warehouse_name', 'geo_name']);
                // Добавляем новые склады в карту
                newWarehouses.forEach(wh => {
                    const key = `${wh.wb_warehouse_name}|${wh.geo_name}`;
                    existingWarehouses.set(key, wh);
                });
            }
            // 2.4. Подготавливаем данные тарифов для пакетной вставки
            const tariffsToInsert = wbData.warehouseList.map(warehouse => {
                const key = `${warehouse.warehouseName}|${warehouse.geoName}`;
                const warehouseRecord = existingWarehouses.get(key);
                return {
                    tariff_request_id: tariffRequestId,
                    warehouse_id: warehouseRecord.id,
                    box_delivery_base: warehouse.boxDeliveryBase,
                    box_delivery_coef_expr: warehouse.boxDeliveryCoefExpr,
                    box_delivery_liter: warehouse.boxDeliveryLiter,
                    box_delivery_marketplace_base: warehouse.boxDeliveryMarketplaceBase,
                    box_delivery_marketplace_coef_expr: warehouse.boxDeliveryMarketplaceCoefExpr,
                    box_delivery_marketplace_liter: warehouse.boxDeliveryMarketplaceLiter,
                    box_storage_base: warehouse.boxStorageBase,
                    box_storage_coef_expr: warehouse.boxStorageCoefExpr,
                    box_storage_liter: warehouse.boxStorageLiter
                };
            });
            // 2.5. Вставляем все тарифы одним запросом
            await trx('tariffs').insert(tariffsToInsert);
            await trx.commit();
            console.log(`Сохранен запрос тарифов с ID: ${tariffRequestId}, складов: ${wbData.warehouseList.length}`);
            return tariffRequestId;
        } catch (error) {
            await trx.rollback();
            console.error('Ошибка при сохранении данных:', error);
            throw error;
        }
    }

    /**
     * Функция для получения данных по запросу тарифов
     */
    async getTariffRequestData(tariffRequestId) {
        return await this.knex('tariff_requests as tr')
            .leftJoin('tariffs as t', 'tr.id', 't.tariff_request_id')
            .leftJoin('warehouses as w', 't.warehouse_id', 'w.id')
            .select(
            'tr.*',
            't.*',
            'w.wb_warehouse_name',
            'w.geo_name'
            )
            .where('tr.id', tariffRequestId);
    }

    async test() {
        try {
            // const result = await this.knex('tariff_requests').select('*');
            // const result = await this.knex('warehouses').select('*');
            const result = await this.knex('tariffs').select('*');
            console.log('result=', result);
        } catch (error) {
            console.error(`Failed to connect to the database: ${error.message}`);
            throw error;
        }
    }

    async test2() {
        try {
            const result = await this.knex.raw('SELECT 1 + 1 AS result');
            const value = result?.rows?.[0]?.result ?? result?.[0]?.result ?? 'unknown';
            console.log('DB test ok:', value);
        } catch (error) {
            console.error(`Failed to connect to the database: ${error.message}`);
            throw error;
        }
    }
}

export default PgService;