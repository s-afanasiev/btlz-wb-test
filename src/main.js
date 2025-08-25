//@ts-nocheck
import dotenv from "dotenv";
dotenv.config();
import WildberriesAPI from './wb/wb-api.js'
import PgService from './postgres/service.js'
import PgService2 from './postgres/service2.js'
import GoogleSheetsService from './google-service/index.js'
import knex from './postgres/knex.ts'

async function main() {
    console.log('main start');
    const pgService = new PgService2(knex);
    const googleService = new GoogleSheetsService();
    await wb_test(pgService, googleService);
    console.log('main end');
}

async function wb_test(pgService, googleService) {
    const token = process.env.WB_API_TOKEN;
    const wbAPI = new WildberriesAPI(token);
  
    try {
        // Получаем актуальные тарифы
        // const wbData = await wbAPI.fetchBoxTariffs('2025-08-25');
        // const result = await pgService.saveWbDataToDBBatch(wbData);
        // console.log(`Данные успешно ${result.isUpdate ? 'обновлены' : 'созданы'}, ID запроса:`, result.tariffRequestId);

        // const googleResult = await pgService.getViewForGoogleSheets();
        await googleService.init();
        googleService.write_test_data();
        
        // console.log('\n📊 Получены тарифы для складов:');
        // tariffs.forEach(tariff => {
        // console.log(`- ${tariff.warehouseName}: доставка от ${tariff.boxDeliveryBase}₽`);
        // });

    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
    }
}

main();