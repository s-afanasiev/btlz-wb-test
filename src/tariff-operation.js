//@ts-nocheck
class TariffOperation {
    constructor(){}

    init(wbAPI, pgService, googleService){
        this.wbAPI = wbAPI;
        this.pgService = pgService;
        this.googleService = googleService;
        return this;
    }
    
    async run(desired_date){
        try {
            // Получаем актуальные тарифы
            const wbData = await this.wbAPI.fetchBoxTariffs(desired_date);
            const pgResult = await this.pgService.saveWbDataToDBBatch(wbData);
            console.log(`Данные успешно ${pgResult.isUpdate ? 'обновлены' : 'созданы'}, ID запроса:`, pgResult.tariffRequestId);

            //@ googleResult = [{tariff_request_id, warehouse_id, box_delivery_base}, {...}]
            const googlePgFormat = await this.pgService.getViewForGoogleSheets();
            // Преобразуем данные
            const googleTableFormat = this.convertToGoogleSheetsFormat(googlePgFormat);
            // console.log('Values:', googleTableFormat.values);
            // console.log('Range:', googleTableFormat.range);
            this.googleService.write_wb_data(googleTableFormat.values, googleTableFormat.range);
            
            // console.log('\n📊 Получены тарифы для складов:');
            // tariffs.forEach(tariff => {
            // console.log(`- ${tariff.warehouseName}: доставка от ${tariff.boxDeliveryBase}₽`);
            // });

        } catch (error) {
            console.error('💥 Критическая ошибка:', error.message);
        }
    }

    // Функция для преобразования данных в формат для Google Sheets
    convertToGoogleSheetsFormat(data) {
        if (!data || data.length === 0) {
            return { values: [], range: 'stocks_coefs!A1:A1' };
        }
        // Получаем заголовки из ключей первого объекта
        const headers = Object.keys(data[0]);
        // Создаем массив values с заголовками в первой строке
        const values = [headers];
        // Добавляем данные каждого объекта как отдельную строку
        data.forEach(item => {
            const row = headers.map(header => {
                const value = item[header];
                // Обрабатываем null/undefined значения
                return value === null || value === undefined ? '' : String(value);
            });
            values.push(row);
        });
        // Вычисляем range на основе размера данных
        const numColumns = headers.length;
        const numRows = values.length;
        const lastColumn = String.fromCharCode(65 + numColumns - 1); // A=65, B=66, etc.
        const range = `stocks_coefs!A1:${lastColumn}${numRows}`;
        return { values, range };
    }
}

export default TariffOperation;