import { SimulationDetail, SimulationSummary, EngineOutput, ModuleId, Params, ScenarioType } from '../models/simulation.types';

export interface SaveSimulationInput {
    moduleId: ModuleId;
    scenario: ScenarioType;
    params: Params;
    fuenteDatos: string;
    equipo: string | null;
    output: EngineOutput;
}

export abstract class SimulationRepository {
    abstract save(input: SaveSimulationInput): Promise<SimulationDetail>;
    abstract findAll(f: { moduleId?: number; scenario?: string; q?: string }): Promise<SimulationSummary[]>;
    abstract findById(id: number): Promise<SimulationDetail | null>;
    abstract delete(id: number): Promise<boolean>;
}