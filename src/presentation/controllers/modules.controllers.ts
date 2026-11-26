import { Body, Controller, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiResponse, ApiTags } from '@nestjs/swagger';
import { EngineRegistry } from '../../aplication/services/engine.registry';
import { RunSimulationUseCase } from '../../aplication/use-cases/run-simulation.use-case';
import { ScenarioType } from '../../domain/models/simulation.types';
import { RunSimulationDto, SCENARIOS } from '../dtos/run-simulation.dto';

const MODULE_PARAM = { name: 'id', type: Number, description: '1 Detención · 2 Deterioro · 3 Oscilaciones · 4 Sensores', example: 1 };

@ApiTags('Módulos')
@Controller('modules')
export class ModulesController {
    constructor(private readonly engines: EngineRegistry, private readonly run: RunSimulationUseCase) { }

    @Get()
    @ApiOperation({ summary: 'Lista los 4 módulos con los parámetros por defecto de los 3 escenarios' })
    @ApiResponse({ status: 200, description: 'Arreglo de módulos con `defaults` por escenario' })
    list() {
        return this.engines.all().map(e => ({
            id: e.moduleId, nombre: e.nombre,
            defaults: { NORMAL: e.defaultParams('NORMAL'), ESTRES: e.defaultParams('ESTRES'), MAL_CONDICIONADO: e.defaultParams('MAL_CONDICIONADO') },
        }));
    }

    @Get(':id/defaults/:scenario')
    @ApiOperation({ summary: 'Parámetros por defecto de un módulo y escenario' })
    @ApiParam(MODULE_PARAM)
    @ApiParam({ name: 'scenario', enum: SCENARIOS })
    @ApiResponse({ status: 404, description: 'Módulo inexistente' })
    defaults(@Param('id', ParseIntPipe) id: number, @Param('scenario') s: ScenarioType) {
        return this.engines.get(id).defaultParams(s);
    }

    @Post(':id/run')
    @ApiOperation({
        summary: 'Ejecuta una simulación y la guarda',
        description: 'Devuelve métodos, iteraciones, errores y las conclusiones numérica y del problema. Con `guardar:false` no persiste (id = null).',
    })
    @ApiParam(MODULE_PARAM)
    @ApiBody({
        type: RunSimulationDto,
        examples: {
            normal: { summary: 'Escenario NORMAL con valores por defecto', value: { scenario: 'NORMAL', equipo: 'Grupo 1' } },
            estres: { summary: 'ESTRÉS sin guardar', value: { scenario: 'ESTRES', guardar: false } },
            malCondicionado: { summary: 'MAL_CONDICIONADO con parámetros propios', value: { scenario: 'MAL_CONDICIONADO', params: { tol: 1e-8 }, equipo: 'Grupo 1' } },
        },
    })
    @ApiResponse({ status: 201, description: 'Simulación ejecutada' })
    @ApiResponse({ status: 400, description: 'Parámetros inválidos (validación de dominio)' })
    @ApiResponse({ status: 404, description: 'Módulo inexistente' })
    execute(@Param('id', ParseIntPipe) id: number, @Body() dto: RunSimulationDto) {
        return this.run.execute(id, dto.scenario, dto.params, dto.equipo ?? null, dto.guardar ?? true);
    }
}