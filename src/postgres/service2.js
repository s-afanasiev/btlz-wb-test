//@ts-nocheck
class SavedWbDataToDB {
    constructor(knex) {
        this.knex = knex;
    }

    getTodayBounds() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { today, tomorrow };
    }

    async insertTariffRequest(trx, wbData) {
        const [tariffRequest] = await trx('tariff_requests')
            .insert({
                dt_next_box: wbData.dtNextBox || null,
                dt_till_max: wbData.dtTillMax || null,
                request_dt: new Date()
            })
            .returning('id');
        return tariffRequest.id;
    }

    async findExistingTodayTariffRequest(trx) {
        const { today, tomorrow } = this.getTodayBounds();
        return await trx('tariff_requests')
            .where('request_dt', '>=', today)
            .where('request_dt', '<', tomorrow)
            .first();
    }

    async saveWarehouseIfNotExist(trx, warehouse) {
        let warehouseRecord = await trx('warehouses')
            .where({
                wb_warehouse_name: warehouse.warehouseName,
                geo_name: warehouse.geoName
            })
            .first();
        if (!warehouseRecord) {
            [warehouseRecord] = await trx('warehouses')
                .insert({
                    wb_warehouse_name: warehouse.warehouseName,
                    geo_name: warehouse.geoName
                })
                .returning(['id']);
        }
        return warehouseRecord;
    }

    async insertTariff(trx, tariffRequestId, warehouse, warehouseRecord) {
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

    async processWarehouses(trx, tariffRequestId, warehouseList) {
        for (const warehouse of warehouseList) {
            const warehouseRecord = await this.saveWarehouseIfNotExist(trx, warehouse);
            await this.insertTariff(trx, tariffRequestId, warehouse, warehouseRecord);
        }
    }

    async clearTariffsForRequest(trx, tariffRequestId) {
        await trx('tariffs')
            .where('tariff_request_id', tariffRequestId)
            .del();
    }

    async execute(wbData) {
        const trx = await this.knex.transaction();
        try {
            const existingTodayRequest = await this.findExistingTodayTariffRequest(trx);
            let isUpdate = false;
            let previousTariffRequestId = null;
            if (existingTodayRequest) {
                isUpdate = true;
                previousTariffRequestId = existingTodayRequest.id;
            }
            const tariffRequestId = await this.insertTariffRequest(trx, wbData);
            await this.processWarehouses(trx, tariffRequestId, wbData.warehouseList);
            // Очищаем тарифы старого запроса, если был запрос ранее сегодня
            if (previousTariffRequestId) {
                await this.clearTariffsForRequest(trx, previousTariffRequestId);
            }
            await trx.commit();
            console.log(`${isUpdate ? 'Обновлен' : 'Создан'} запрос тарифов с ID: ${tariffRequestId}`);
            return { tariffRequestId, isUpdate };
        } catch (error) {
            await trx.rollback();
            console.error('Ошибка при сохранении данных:', error);
            throw error;
        }
    }
}

class SavedWbBatchToDB {
    constructor(knex) {
        this.knex = knex;
    }

    getTodayBounds() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return { today, tomorrow };
    }

    async findExistingTodayTariffRequest(trx) {
        const { today, tomorrow } = this.getTodayBounds();
        return await trx('tariff_requests')
            .where('request_dt', '>=', today)
            .where('request_dt', '<', tomorrow)
            .first();
    }

    async createTariffRequest(trx, wbData) {
        const [tariffRequest] = await trx('tariff_requests')
            .insert({
                dt_next_box: wbData.dtNextBox || null,
                dt_till_max: wbData.dtTillMax || null,
                request_dt: new Date()
            })
            .returning('id');
        return tariffRequest.id;
    }

    async clearTariffsForRequest(trx, tariffRequestId) {
        await trx('tariffs')
            .where('tariff_request_id', tariffRequestId)
            .del();
    }

    async loadExistingWarehousesMap(trx) {
        const map = new Map();
        const rows = await trx('warehouses').select('*');
        rows.forEach(wh => {
            const key = `${wh.wb_warehouse_name}|${wh.geo_name}`;
            map.set(key, wh);
        });
        return map;
    }

    computeWarehousesToInsert(wbData, existingMap) {
        const toInsert = [];
        for (const warehouse of wbData.warehouseList) {
            const key = `${warehouse.warehouseName}|${warehouse.geoName}`;
            if (!existingMap.has(key)) {
                toInsert.push({
                    wb_warehouse_name: warehouse.warehouseName,
                    geo_name: warehouse.geoName
                });
            }
        }
        return toInsert;
    }

    async insertWarehousesBatch(trx, warehousesToInsert, existingMap) {
        if (warehousesToInsert.length === 0) return;
        const newWarehouses = await trx('warehouses')
            .insert(warehousesToInsert)
            .returning(['id', 'wb_warehouse_name', 'geo_name']);
        newWarehouses.forEach(wh => {
            const key = `${wh.wb_warehouse_name}|${wh.geo_name}`;
            existingMap.set(key, wh);
        });
    }

    buildTariffsRows(wbData, tariffRequestId, existingMap) {
        return wbData.warehouseList.map(warehouse => {
            const key = `${warehouse.warehouseName}|${warehouse.geoName}`;
            const warehouseRecord = existingMap.get(key);
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
    }

    async insertTariffsBatch(trx, tariffsRows) {
        if (tariffsRows.length === 0) return;
        await trx('tariffs').insert(tariffsRows);
    }

    async execute(wbData) {
        const trx = await this.knex.transaction();
        try {
            // 1) Найти существующий запрос за сегодня (если есть), запомнить его id
            const existingTodayRequest = await this.findExistingTodayTariffRequest(trx);
            const previousTariffRequestId = existingTodayRequest ? existingTodayRequest.id : null;
            const isUpdate = Boolean(previousTariffRequestId);

            // 2) Создать новый запрос за сегодня
            const tariffRequestId = await this.createTariffRequest(trx, wbData);

            // 3) Складская часть: загрузить карту, дозавести недостающие
            const existingWarehouses = await this.loadExistingWarehousesMap(trx);
            const warehousesToInsert = this.computeWarehousesToInsert(wbData, existingWarehouses);
            await this.insertWarehousesBatch(trx, warehousesToInsert, existingWarehouses);

            // 4) Подготовить и вставить тарифы пачкой для нового запроса
            const tariffsToInsert = this.buildTariffsRows(wbData, tariffRequestId, existingWarehouses);
            await this.insertTariffsBatch(trx, tariffsToInsert);

            // 5) Если ранее сегодня был запрос — очистить его тарифы
            if (previousTariffRequestId) {
                await this.clearTariffsForRequest(trx, previousTariffRequestId);
            }

            await trx.commit();
            console.log(`${isUpdate ? 'Обновлен' : 'Создан'} запрос тарифов с ID: ${tariffRequestId}, складов: ${wbData.warehouseList.length}`);
            return { tariffRequestId, isUpdate };
        } catch (error) {
            await trx.rollback();
            console.error('Ошибка при сохранении данных:', error);
            throw error;
        }
    }
}

class PgService2 {
    constructor(knex) {
        this.knex = knex;
    }
    /**
     * Сохранение данных от Wildberries API в базу данных
     * @param {Object} wbData - данные от Wildberries
     */
    async saveWbDataToDB(wbData) {
        const saver = new SavedWbDataToDB(this.knex);
        return await saver.execute(wbData);
    }

    /**
     * Альтернативный вариант с пакетной вставкой для лучшей производительности
     */
    async saveWbDataToDBBatch(wbData) {
        const saver = new SavedWbBatchToDB(this.knex);
        return await saver.execute(wbData);
    }

    /**
     * Функция для получения последнего запроса тарифов за сегодня
     */
    async getTodayTariffRequest() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return await this.knex('tariff_requests')
            .where('request_dt', '>=', today)
            .where('request_dt', '<', tomorrow)
            .orderBy('request_dt', 'desc')
            .first();
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

    async getViewForGoogleSheets() {
        return await this.knex('current_tariffs').select('*');
    }
}

export { SavedWbDataToDB };
export { SavedWbBatchToDB };
export default PgService2;