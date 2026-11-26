import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { DeleteSimulationUseCase, GetSimulationUseCase, ListSimulationsUseCase } from '../../aplication/use-cases/simulation-history.use-cases';
import { RerunSimulationUseCase } from '../../aplication/use-cases/rerun-simulation.use-case';
import { RerunSimulationDto } from '../dtos/rerun-simulation.dto';
import { SCENARIOS } from '../dtos/run-simulation.dto';

const ID_PARAM = { name: 'id', type: Number, example: 1, description: 'ID de la simulación' };

@ApiTags('Historial')
@Controller('simulations')
export class SimulationsController {
    constructor(
        private readonly list: ListSimulationsUseCase, private readonly get: GetSimulationUseCase,
        private readonly del: DeleteSimulationUseCase, private readonly rerun: RerunSimulationUseCase,
    ) { }

    @Get()
    @ApiOperation({ summary: 'Busca en el historial (máx. 200, más recientes primero)' })
    @ApiQuery({ name: 'moduleId', required: false, type: Number, enum: [1, 2, 3, 4] })
    @ApiQuery({ name: 'scenario', required: false, enum: SCENARIOS })
    @ApiQuery({ name: 'q', required: false, description: 'Texto en equipo, nombre del módulo o conclusión del problema' })
    findAll(@Query('moduleId') moduleId?: string, @Query('scenario') scenario?: string, @Query('q') q?: string) {
        return this.list.execute({ moduleId: moduleId ? +moduleId : undefined, scenario, q });
    }

    @Get(':id')
    @ApiOperation({ summary: 'Abre una simulación guardada completa (parámetros, iteraciones, resúmenes y conclusiones)' })
    @ApiParam(ID_PARAM)
    @ApiResponse({ status: 404, description: 'No existe' })
    findOne(@Param('id', ParseIntPipe) id: number) { return this.get.execute(id); }

    @Post(':id/rerun')
    @ApiOperation({
        summary: 'Relanza una simulación guardada y compara con lo almacenado',
        description: 'Prueba obligatoria de persistencia: devuelve `coincide` y la diferencia por método y métrica dentro de la tolerancia.',
    })
    @ApiParam(ID_PARAM)
    @ApiResponse({ status: 201, description: 'Resultado de la comparación' })
    @ApiResponse({ status: 404, description: 'No existe' })
    relaunch(@Param('id', ParseIntPipe) id: number, @Body() b: RerunSimulationDto) {
        return this.rerun.execute(id, b?.tolerancia, b?.guardarNueva);
    }

    @Delete(':id') @HttpCode(204)
    @ApiOperation({ summary: 'Elimina una simulación (y su escenario, ejecuciones e iteraciones en cascada)' })
    @ApiParam(ID_PARAM)
    @ApiResponse({ status: 204, description: 'Eliminada' })
    @ApiResponse({ status: 404, description: 'No existe' })
    async remove(@Param('id', ParseIntPipe) id: number) { await this.del.execute(id); }
}