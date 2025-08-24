/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
    return knex.schema.createTable('tariff_requests', (table) => {
    table.bigIncrements('id').primary(); // BIGSERIAL PRIMARY KEY
    table.timestamp('request_dt').notNullable().defaultTo(knex.fn.now()); // TIMESTAMPTZ
    table.date('dt_next_box').notNullable(); // DATE
    table.date('dt_till_max').notNullable(); // DATE
    table.jsonb('raw_response_json'); // JSONB (опционально)
    
    // Индекс для частых запросов по дате
    table.index('request_dt');
  });
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
    return knex.schema.dropTable('tariff_requests');
}
