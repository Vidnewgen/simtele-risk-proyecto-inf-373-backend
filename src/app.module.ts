import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SimulationRepository } from './domain/repositories/simulation.repository';
import { EngineRegistry } from './aplication/services/engine.registry';
import { RunSimulationUseCase } from './aplication/use-cases/run-simulation.use-case';
import { DeleteSimulationUseCase, GetSimulationUseCase, ListSimulationsUseCase } from './aplication/use-cases/simulation-history.use-cases';
import { RerunSimulationUseCase } from './aplication/use-cases/rerun-simulation.use-case';
import { typeOrmConfig } from './infrastructure/database/typeorm.config';
import { SimulationTypeOrmRepository } from './infrastructure/repositories/simulation.typeorm.repository';
import { ModulesController } from './presentation/controllers/modules.controllers';
import { SimulationsController } from './presentation/controllers/simulations.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({ inject: [ConfigService], useFactory: typeOrmConfig }),
  ],
  controllers: [ModulesController, SimulationsController],
  providers: [
    EngineRegistry,
    { provide: SimulationRepository, useClass: SimulationTypeOrmRepository },   // inversión de dependencias
    RunSimulationUseCase, ListSimulationsUseCase, GetSimulationUseCase, DeleteSimulationUseCase, RerunSimulationUseCase,
  ],
})
export class AppModule { }