import { Injectable } from '@nestjs/common';
import { NotFoundError } from '../../domain/errors/domain.errors';
import { ModuleEngine, ModuleId } from '../../domain/models/simulation.types';
import { Module1Engine } from './module1.engine';
import { Module2Engine } from './module2.engine';
import { Module3Engine } from './module3.engine';
import { Module4Engine } from './module4.engine';

@Injectable()
export class EngineRegistry {
    private engines = new Map<number, ModuleEngine>(
        [new Module1Engine(), new Module2Engine(), new Module3Engine(), new Module4Engine()].map(e => [e.moduleId, e]),
    );
    get(id: number): ModuleEngine {
        const e = this.engines.get(id);
        if (!e) throw new NotFoundError(`Módulo ${id} no existe (1..4)`);
        return e;
    }
    all(): ModuleEngine[] { return [...this.engines.values()]; }
}