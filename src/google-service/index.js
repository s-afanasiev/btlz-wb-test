//@ts-nocheck
import { google } from 'googleapis';
import path from 'path';

class GoogleSheetsService {
    constructor() {
        this.auth = null;
        this.sheets = null;
        this.testSheetId = '1LzFkTu5sB_kfF9ngM0uMNva1uz41FfJCrV7WNJfAac0';
    }

    async init() {
        try {
            // Путь к вашему JSON-файлу сервисного аккаунта
            const keyFilePath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
            const auth = new google.auth.GoogleAuth({
                keyFile: keyFilePath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });
            this.auth = await auth.getClient();
            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            console.log('Google Sheets API initialized successfully');
            return this;
        } catch (error) {
            console.error('Error initializing Google Sheets API:', error.message);
            throw error;
        }
    }

    // Запись данных в таблицу
    async writeToSheet(spreadsheetId, range, values) {
        try {
            const request = {
                spreadsheetId,
                range,
                valueInputOption: 'USER_ENTERED',
                resource: {
                    values: values
                },
                auth: this.auth
            };

            const response = await this.sheets.spreadsheets.values.update(request);
            console.log('Data written successfully:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error writing to sheet:', error);
            throw error;
        }
    }

    // Чтение данных из таблицы
    async readFromSheet(spreadsheetId, range) {
        try {
            const response = await this.sheets.spreadsheets.values.get({
                spreadsheetId,
                range,
                auth: this.auth
            });

            return response.data.values || [];
        } catch (error) {
            console.error('Error reading from sheet:', error);
            throw error;
        }
    }

    // Очистка диапазона
    async clearSheet(spreadsheetId, range) {
        try {
            const response = await this.sheets.spreadsheets.values.clear({
                spreadsheetId,
                range,
                auth: this.auth
            });

            console.log('Range cleared successfully:', response.data);
            return response.data;
        } catch (error) {
            console.error('Error clearing sheet:', error);
            throw error;
        }
    }

    // Пакетное обновление (более эффективно для больших объемов данных)
    async batchUpdate(spreadsheetId, requests) {
        try {
            const response = await this.sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                resource: {
                    requests: requests
                },
                auth: this.auth
            });

            return response.data;
        } catch (error) {
            console.error('Error in batch update:', error);
            throw error;
        }
    }

    async write_test_data() {
        const values = [['aa', 'bb'], ['cc', 'dd']];
        const range = 'stocks_coefs!A1:B2'
        this.writeToSheet(this.testSheetId, range, values);
    }
}

export default GoogleSheetsService;