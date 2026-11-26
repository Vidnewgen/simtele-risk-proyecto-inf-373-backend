import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { DeleteSimulationUseCase, GetSimulationUseCase, ListSimulationsUseCase } from '../../aplication/use-cases/simulation-history.use-cases';
import { RerunSimulationUseCase } from '../../aplication/use-cases/rerun-simulation.use-case';

@Controller('simulations')
export class SimulationsController {
    constructor(
        private readonly list: ListSimulationsUseCase, private readonly get: GetSimulationUseCase,
        private readonly del: DeleteSimulationUseCase, private readonly rerun: RerunSimulationUseCase,
    ) { }

    @Get() findAll(@Query('moduleId') moduleId?: string, @Query('scenario') scenario?: string, @Query('q') q?: string) {
        return this.list.execute({ moduleId: moduleId ? +moduleId : undefined, scenario, q });
    }
    @Get(':id') findOne(@Param('id', ParseIntPipe) id: number) { return this.get.execute(id); }

    @Post(':id/rerun')
    relaunch(@Param('id', ParseIntPipe) id: number, @Body() b: { tolerancia?: number; guardarNueva?: boolean }) {
        return this.rerun.execute(id, b?.tolerancia, b?.guardarNueva);
    }

    @Delete(':id') @HttpCode(204)
    async remove(@Param('id', ParseIntPipe) id: number) { await this.del.execute(id); }
}