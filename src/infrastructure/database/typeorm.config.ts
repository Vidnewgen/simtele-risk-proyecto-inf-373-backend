import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import * as E from './entities/der.entities';

export const typeOrmConfig = (c: ConfigService): TypeOrmModuleOptions => ({
    type: 'postgres',
    host: c.get('DB_HOST', 'localhost'), port: +c.get('DB_PORT', '5432'),
    username: c.get('DB_USER', 'postgres'), password: c.get('DB_PASS', 'postgres'), database: c.get('DB_NAME', 'simtele'),
    entities: [E.CasoEstudio, E.Escenario, E.Simulacion, E.EjecucionMetodo, E.IteracionResultado, E.ResultadoResumen],
    synchronize: c.get('DB_SYNC', 'true') === 'true',     // desarrollo; para entrega usar migraciones
    migrations: ['dist/infrastructure/database/migrations/*.js'],
});