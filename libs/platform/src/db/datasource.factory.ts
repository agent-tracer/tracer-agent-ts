import "reflect-metadata";
import { DataSource, type EntitySchema, type MixedList } from "typeorm";
import type { DbConfig } from "../config/application.config.schema.js";

type Ctor = new (...args: never[]) => object;

export interface DataSourceParams {
    readonly db: DbConfig;
    readonly entities: MixedList<Ctor | string | EntitySchema>;
}

export function createDataSource(params: DataSourceParams): DataSource {
    return new DataSource({
        type: "postgres",
        host: params.db.host,
        port: params.db.port,
        username: params.db.username,
        password: params.db.password,
        database: params.db.database,
        entities: params.entities,
        migrations: [],
        migrationsRun: false,
        synchronize: false,
        logging: false,
    });
}
