import { migrate, seed } from "#postgres/knex.js";
import knex from "#postgres/knex.js";
import { Command } from "commander";
const program = new Command();

program
    .command("migrate")
    .argument("[type]", "latest|rollback|status|down|up|list|make")
    .argument("[arg]", "version")
    .action(async (action, arg) => {
        if (!action) return;
        try {
            if (action === "latest") await migrate.latest();
            if (action === "rollback") await migrate.rollback();
            if (action === "down") await migrate.down(arg);
            if (action === "up") await migrate.up(arg);
            if (action === "list") await migrate.list();
            if (action === "make") {
                if (!arg) {
                    console.error("Please provide a migration name");
                    process.exit(1);
                }
                await migrate.make(arg);
            }
        } catch (error) {
            console.error(`Migration error: ${error}`);
            process.exit(1);
        }
        
        process.exit(0);
    });

program.command("seed [action] [arg]").action(async (action, arg) => {
    if (!action) return;
    
    try {
        if (action === "run") await seed.run();
        if (action === "make") {
            if (!arg) {
                console.error("Please provide a seed name");
                process.exit(1);
            }
            await seed.make(arg);
        }
    } catch (error) {
        console.error(`Seed error: ${error}`);
        process.exit(1);
    }
    
    process.exit(0);
});

program
    .command("select <table> [limit]")
    .description("Select rows from a table. Default limit is 10.")
    .action(async (table: string, limit?: string) => {
        try {
            const parsedLimit = Number.isFinite(Number(limit)) ? Number(limit) : 10;
            const rows = await knex(table).select("*").limit(parsedLimit);
            console.log(JSON.stringify(rows, null, 2));
        } catch (error) {
            console.error(`Select error: ${error}`);
            process.exit(1);
        }
        process.exit(0);
    });

program.command("default", { isDefault: true }).action(() => {});
program.parse();
