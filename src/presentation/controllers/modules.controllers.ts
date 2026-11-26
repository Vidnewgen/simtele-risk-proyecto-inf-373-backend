import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { EngineRegistry } from '../../aplication/services/engine.registry';
import { RunSimulationUseCase } from '../../aplication/use-cases/run-simulation.use-case';
import { ScenarioType } from '../../domain/models/simulation.types';
import { RunSimulationDto } from '../dtos/run-simulation.dto';

@Controller('modules')
export class ModulesController {
    constructor(private readonly engines: EngineRegistry, private readonly run: RunSimulationUseCase) { }

    @Get()
    list() {
        return this.engines.all().map(e => ({
            id: e.moduleId, nombre: e.nombre,
            defaults: { NORMAL: e.defaultParams('NORMAL'), ESTRES: e.defaultParams('ESTRES'), MAL_CONDICIONADO: e.defaultParams('MAL_CONDICIONADO') },
        }));
    }

    @Get(':id/defaults/:scenario')
    defaults(@Param('id', ParseIntPipe) id: number, @Param('scenario') s: ScenarioType) {
        return this.engines.get(id).defaultParams(s);
    }

    @Post(':id/run')
    execute(@Param('id', ParseIntPipe) id: number, @Body() dto: RunSimulationDto) {
        return this.run.execute(id, dto.scenario, dto.params, dto.equipo ?? null, dto.guardar ?? true);
    }
}