//@ts-nocheck
import { google } from 'googleapis';
import path from 'path';

class GoogleSheetsService {
    constructor() {
        this.auth = null;
        this.sheets = null;
        this.initializeAuth();
    }

    async initializeAuth() {
        try {
            // Путь к вашему JSON-файлу сервисного аккаунта
            const keyFilePath = path.join(__dirname, '..', 'config', 'your-service-account-key.json');
            
            const auth = new google.auth.GoogleAuth({
                keyFile: keyFilePath,
                scopes: ['https://www.googleapis.com/auth/spreadsheets'],
            });

            this.auth = await auth.getClient();
            this.sheets = google.sheets({ version: 'v4', auth: this.auth });
            
            console.log('Google Sheets API initialized successfully');
        } catch (error) {
            console.error('Error initializing Google Sheets API:', error);
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
}

export default new GoogleSheetsService();