/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function up(knex) {
    return knex.schema.raw(`
    CREATE VIEW current_tariffs AS
    SELECT DISTINCT ON (tar.warehouse_id)
        tar.*,
        wh.wb_warehouse_name,
        wh.geo_name,
        tr.request_dt,
        tr.dt_next_box,
        tr.dt_till_max
    FROM tariffs tar
    JOIN tariff_requests tr ON tar.tariff_request_id = tr.id
    JOIN warehouses wh ON tar.warehouse_id = wh.id
    ORDER BY tar.warehouse_id, tr.request_dt DESC;
  `);
}

/**
 * @param {import("knex").Knex} knex
 * @returns {Promise<void>}
 */
export async function down(knex) {
    return knex.schema.raw(`
        DROP VIEW IF EXISTS current_tariffs;
    `);
}
