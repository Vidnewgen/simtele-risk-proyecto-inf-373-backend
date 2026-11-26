import { Injectable } from '@nestjs/common';
import { ModuleId, Params, ScenarioType, SimulationDetail } from '../../domain/models/simulation.types';
import { SimulationRepository } from '../../domain/repositories/simulation.repository';
import { EngineRegistry } from '../services/engine.registry';

@Injectable()
export class RunSimulationUseCase {
    constructor(private readonly engines: EngineRegistry, private readonly repo: SimulationRepository) { }

    async execute(moduleId: number, scenario: ScenarioType, params: Params | undefined, equipo: string | null, guardar = true) {
        const engine = this.engines.get(moduleId);
        const merged = { ...engine.defaultParams(scenario), ...(params ?? {}) };
        const output = engine.run(scenario, merged);
        if (!guardar) return { id: null, moduleId, scenario, params: merged, ...output };
        return this.repo.save({ moduleId: moduleId as ModuleId, scenario, params: merged, fuenteDatos: 'sintetico-educativo', equipo, output });
    }
}