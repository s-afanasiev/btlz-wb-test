import knex, { migrate, seed } from "#postgres/knex.js";
import main from "./main.js";

async function startApplication() {
    try {
        console.log("Starting application...");
        
        // Запускаем миграции
        console.log("Running database migrations...");
        await migrate.latest();
        console.log("Migrations completed successfully");
        
        // Запускаем сиды
        console.log("Running database seeds...");
        await seed.run();
        console.log("Seeds completed successfully");
        
        // Запускаем основное приложение
        console.log("Starting main application...");
        await main();
        
        console.log("Application started successfully");
    } catch (error) {
        console.error("Failed to start application:", error);
        process.exit(1);
    }
}

// Запускаем приложение
startApplication().catch(error => {
    console.error("Unhandled error:", error);
    process.exit(1);
});