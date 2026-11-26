import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../domain/errors/domain.errors';
import { SimulationRepository } from '../../domain/repositories/simulation.repository';
import { EngineRegistry } from '../services/engine.registry';

@Injectable()
export class RerunSimulationUseCase {
    constructor(private readonly engines: EngineRegistry, private readonly repo: SimulationRepository) { }

    async execute(id: number, tolerancia = 1e-9, guardarNueva = false) {
        const saved = await this.repo.findById(id);
        if (!saved) throw new NotFoundError(`Simulación ${id} no encontrada`);
        const out = this.engines.get(saved.moduleId).run(saved.scenario, saved.params);

        const diffs: { metodo: string; metrica: string; guardado: number; nuevo: number; dif: number; ok: boolean }[] = [];
        for (const m of out.methods) {
            const old = saved.methods.find(x => x.metodo === m.metodo);
            if (!old) continue;
            for (const [k, v] of Object.entries(m.resumen.metricaError)) {
                const o = old.resumen.metricaError[k];
                if (typeof v !== 'number' || typeof o !== 'number') continue;
                const dif = Math.abs(v - o);
                diffs.push({ metodo: m.metodo, metrica: k, guardado: o, nuevo: v, dif, ok: dif <= tolerancia * Math.max(1, Math.abs(o)) });
            }
        }
        const nueva = guardarNueva
            ? await this.repo.save({ moduleId: saved.moduleId, scenario: saved.scenario, params: saved.params, fuenteDatos: saved.fuenteDatos, equipo: saved.equipo, output: out })
            : null;
        return { simulacionOriginal: id, tolerancia, coincide: diffs.every(d => d.ok), comparaciones: diffs, nuevaSimulacionId: nueva?.id ?? null };
    }
}