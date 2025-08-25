//@ts-nocheck
import dotenv from "dotenv";
dotenv.config();
import WildberriesAPI from './wb/wb-api.js'
import PgService from './postgres/service.js'
import TariffOperation from './tariff-operation.js'
import GoogleSheetsService from './google-service/index.js'
import knex from './postgres/knex.ts'

async function main() {
    console.log('main start');
    const pgService = new PgService(knex);
    const googleService = await new GoogleSheetsService().init();
    const token = process.env.WB_API_TOKEN;
    const wbAPI = new WildberriesAPI(token);
    cycle_operations(wbAPI, pgService, googleService);
}

async function cycle_operations(wbAPI, pgService, googleService) {
    try {
        console.debug('main: выполняем процедуру обновления данных WB...');
        const tariffOperation = new TariffOperation().init(wbAPI, pgService, googleService);
        //@ Преобразование текущей даты к виду: 'ГГГГ-ММ-ДД'
        const todayTimeMyFormat = formatDate(new Date());
        await tariffOperation.run(todayTimeMyFormat);
    } catch (err) {
        console.error(`main: НЕ УДАЛОСЬ обновить данные WB: ${err.message}`);
    }

    const one_hour = 3600000;
    setTimeout(()=>{
        cycle_operations(wbAPI, pgService, googleService)
    }, one_hour);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // Месяцы начинаются с 0
  const day = String(date.getDate()).padStart(2, '0');

  return `${year}-${month}-${day}`;
}

// main();
export default main;