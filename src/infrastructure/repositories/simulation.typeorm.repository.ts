import { Injectable, OnModuleInit } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, ILike } from 'typeorm';
import { MethodRun, ModuleId, ScenarioType, SimulationDetail, SimulationSummary } from '../../domain/models/simulation.types';
import { SaveSimulationInput, SimulationRepository } from '../../domain/repositories/simulation.repository';
import { EngineRegistry } from '../../aplication/services/engine.registry';
import { CasoEstudio, EjecucionMetodo, Escenario, IteracionResultado, ResultadoResumen, Simulacion } from '../database/entities/der.entities';

// jsonb no admite NaN/Infinity
const clean = (v: any): any => JSON.parse(JSON.stringify(v, (_, x) => (typeof x === 'number' && !isFinite(x) ? null : x)));
const num = (x: number | null) => (x === null || !isFinite(x) ? null : x);

@Injectable()
export class SimulationTypeOrmRepository extends SimulationRepository implements OnModuleInit {
    constructor(@InjectDataSource() private readonly ds: DataSource, private readonly engines: EngineRegistry) { super(); }

    async onModuleInit() {                       // siembra del catálogo de casos de estudio
        const repo = this.ds.getRepository(CasoEstudio);
        for (const e of this.engines.all()) await repo.save({ id: e.moduleId, nombre: e.nombre, modeloVersion: 'v1.0' });
    }

    async save(i: SaveSimulationInput): Promise<SimulationDetail> {
        const id = await this.ds.transaction(async tx => {
            const esc = await tx.save(Escenario, { casoId: i.moduleId, tipo: i.scenario, parametrosJson: clean(i.params), fuenteDatos: i.fuenteDatos });
            const sim = await tx.save(Simulacion, { escenarioId: esc.id, equipo: i.equipo, estado: 'COMPLETADA', conclusionNumerica: i.output.conclusionNumerica, conclusionProblema: i.output.conclusionProblema });
            for (const m of i.output.methods) {
                const ej = await tx.save(EjecucionMetodo, { simulacionId: sim.id, metodo: m.metodo, familia: m.familia, tolerancia: num(m.tolerancia), paso: num(m.paso), maxIter: m.maxIter, convergio: m.convergio, tiempoMs: m.tiempoMs });
                const rows = m.iteraciones.map(r => ({ ejecucionId: ej.id, numero: r.numero, aproximacionJson: clean(r.aproximacion), residual: num(r.residual), errorAbs: num(r.errorAbs), errorRel: num(r.errorRel) }));
                for (let k = 0; k < rows.length; k += 1000) await tx.insert(IteracionResultado, rows.slice(k, k + 1000));
                await tx.save(ResultadoResumen, { ejecucionId: ej.id, referencia: num(m.resumen.referencia), valorJson: clean(m.resumen.valor), metricaErrorJson: clean(m.resumen.metricaError), interpretacion: m.resumen.interpretacion });
            }
            return sim.id;
        });
        return (await this.findById(id))!;
    }

    async findAll(f: { moduleId?: number; scenario?: string; q?: string }): Promise<SimulationSummary[]> {
        const qb = this.ds.getRepository(Simulacion).createQueryBuilder('s').innerJoinAndSelect('s.escenario', 'e').innerJoinAndSelect('e.caso', 'c').orderBy('s.fecha', 'DESC').limit(200);
        if (f.moduleId) qb.andWhere('e.caso_id = :m', { m: f.moduleId });
        if (f.scenario) qb.andWhere('e.tipo = :t', { t: f.scenario });
        if (f.q) qb.andWhere('(s.equipo ILIKE :q OR c.nombre ILIKE :q OR s.conclusion_problema ILIKE :q)', { q: `%${f.q}%` });
        return (await qb.getMany()).map(s => ({ id: s.id, moduleId: s.escenario.casoId as ModuleId, moduleName: s.escenario.caso.nombre, scenario: s.escenario.tipo as ScenarioType, fecha: s.fecha, equipo: s.equipo, estado: s.estado }));
    }

    async findById(id: number): Promise<SimulationDetail | null> {
        const s = await this.ds.getRepository(Simulacion).findOne({ where: { id }, relations: { escenario: true } });
        if (!s) return null;
        const ejs = await this.ds.getRepository(EjecucionMetodo).find({ where: { simulacionId: id }, order: { id: 'ASC' } });
        const methods: MethodRun[] = [];
        for (const e of ejs) {
            const its = await this.ds.getRepository(IteracionResultado).find({ where: { ejecucionId: e.id }, order: { numero: 'ASC' } });
            const r = await this.ds.getRepository(ResultadoResumen).findOneByOrFail({ ejecucionId: e.id });
            methods.push({
                metodo: e.metodo, familia: e.familia, tolerancia: e.tolerancia, paso: e.paso, maxIter: e.maxIter, convergio: e.convergio, tiempoMs: e.tiempoMs,
                iteraciones: its.map(x => ({ numero: x.numero, aproximacion: x.aproximacionJson, residual: x.residual, errorAbs: x.errorAbs, errorRel: x.errorRel })),
                resumen: { referencia: r.referencia, valor: r.valorJson, metricaError: r.metricaErrorJson, interpretacion: r.interpretacion },
            });
        }
        return {
            id: s.id, moduleId: s.escenario.casoId as ModuleId, scenario: s.escenario.tipo as ScenarioType, params: s.escenario.parametrosJson, fuenteDatos: s.escenario.fuenteDatos,
            fecha: s.fecha, equipo: s.equipo, estado: s.estado, conclusionNumerica: s.conclusionNumerica, conclusionProblema: s.conclusionProblema, methods,
        };
    }

    async delete(id: number): Promise<boolean> {
        const s = await this.ds.getRepository(Simulacion).findOneBy({ id });
        if (!s) return false;
        await this.ds.getRepository(Escenario).delete(s.escenarioId);   // cascada a simulación → ejecuciones → iteraciones
        return true;
    }
}