/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
    return knex.schema.createTable('tariffs', function(table) {
        // Внешний ключ на tariff_requests
        table.bigInteger('tariff_request_id')
            .notNullable()
            .references('id')
            .inTable('tariff_requests')
            .onDelete('CASCADE'); // Удаляем тарифы при удалении запроса
        // Внешний ключ на warehouses
        table.integer('warehouse_id')
            .notNullable()
            .references('id')
            .inTable('warehouses')
            .onDelete('CASCADE'); // Удаляем тарифы при удалении склада
        // Тарифные поля
        table.string('box_delivery_base', 50); // VARCHAR(50) (может быть '-')
        table.string('box_delivery_coef_expr', 50);
        table.string('box_delivery_liter', 50);
        table.string('box_delivery_marketplace_base', 50);
        table.string('box_delivery_marketplace_coef_expr', 50);
        table.string('box_delivery_marketplace_liter', 50);
        table.string('box_storage_base', 50);
        table.string('box_storage_coef_expr', 50);
        table.string('box_storage_liter', 50);
        // Индексы для внешних ключей (очень важны для производительности!)
        table.index('tariff_request_id');
        table.index('warehouse_id');
        // Составной индекс для избежания дублирования данных
        table.unique(['tariff_request_id', 'warehouse_id']);
    });
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
    return knex.schema.dropTable('tariffs');
}
