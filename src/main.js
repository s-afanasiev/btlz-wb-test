//@ts-nocheck
import dotenv from "dotenv";
dotenv.config();
import WildberriesAPI from './wb/wb-api.js'

async function main() {
    console.log('main start');
    await wb_test();
    console.log('main end');
}

async function wb_test() {
    const token = process.env.WB_API_TOKEN;
    const wbAPI = new WildberriesAPI(token);
  
    try {
        // Получаем актуальные тарифы
        const tariffs = await wbAPI.fetchBoxTariffs('2025-08-25');
        
        console.log('\n📊 Получены тарифы для складов:');
        tariffs.forEach(tariff => {
        console.log(`- ${tariff.warehouseName}: доставка от ${tariff.boxDeliveryBase}₽`);
        });

    } catch (error) {
        console.error('💥 Критическая ошибка:', error.message);
    }
}

main();