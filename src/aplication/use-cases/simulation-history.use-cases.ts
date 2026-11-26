import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../domain/errors/domain.errors';
import { SimulationRepository } from '../../domain/repositories/simulation.repository';

@Injectable()
export class ListSimulationsUseCase {
    constructor(private readonly repo: SimulationRepository) { }
    execute(f: { moduleId?: number; scenario?: string; q?: string }) { return this.repo.findAll(f); }
}
@Injectable()
export class GetSimulationUseCase {
    constructor(private readonly repo: SimulationRepository) { }
    async execute(id: number) {
        const s = await this.repo.findById(id);
        if (!s) throw new NotFoundError(`Simulación ${id} no encontrada`);
        return s;
    }
}
@Injectable()
export class DeleteSimulationUseCase {
    constructor(private readonly repo: SimulationRepository) { }
    async execute(id: number) {
        if (!(await this.repo.delete(id))) throw new NotFoundError(`Simulación ${id} no encontrada`);
    }
}