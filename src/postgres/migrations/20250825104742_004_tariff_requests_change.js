/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
    return knex.schema.alterTable('tariff_requests', (table) => {
        table.date('dt_next_box').nullable().alter();
        table.date('dt_till_max').nullable().alter();
    });
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
    return knex.schema.alterTable('tariff_requests', (table) => {
        table.date('dt_next_box').notNullable().alter();
        table.date('dt_till_max').notNullable().alter();
    });
}
