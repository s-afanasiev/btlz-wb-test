/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
    return knex.schema.createTable('warehouses', (table) => {
        table.increments('id').primary(); // SERIAL PRIMARY KEY
        table.string('wb_warehouse_name', 255).notNullable(); // VARCHAR(255)
        table.string('geo_name', 255).notNullable(); // VARCHAR(255)

        // Уникальный индекс для предотвращения дубликатов складов
        table.unique(['wb_warehouse_name', 'geo_name']);
        // Индекс для быстрого поиска по названию склада
        table.index('wb_warehouse_name');
    });
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
    return knex.schema.dropTable('warehouses');
}
