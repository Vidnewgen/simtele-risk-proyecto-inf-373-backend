export type ScenarioType = 'NORMAL' | 'ESTRES' | 'MAL_CONDICIONADO';
export type ModuleId = 1 | 2 | 3 | 4;
export type Params = Record<string, any>;

export interface IterationRow {
    numero: number;
    aproximacion: Record<string, any>;
    residual: number | null;
    errorAbs: number | null;
    errorRel: number | null;
}

export interface MethodRun {
    metodo: string;
    familia: string;
    tolerancia: number | null;
    paso: number | null;
    maxIter: number | null;
    convergio: boolean;
    tiempoMs: number;
    iteraciones: IterationRow[];
    resumen: {
        referencia: number | null;
        valor: any;
        metricaError: Record<string, number | null>;
        interpretacion: string;
    };
}

export interface EngineOutput {
    methods: MethodRun[];
    conclusionNumerica: string;
    conclusionProblema: string;
}

export interface ModuleEngine {
    readonly moduleId: ModuleId;
    readonly nombre: string;
    defaultParams(s: ScenarioType): Params;
    run(s: ScenarioType, params: Params): EngineOutput;
}

export interface SimulationDetail extends EngineOutput {
    id: number;
    moduleId: ModuleId;
    scenario: ScenarioType;
    params: Params;
    fuenteDatos: string;
    fecha: Date;
    equipo: string | null;
    estado: string;
}

export interface SimulationSummary {
    id: number;
    moduleId: ModuleId;
    moduleName: string;
    scenario: ScenarioType;
    fecha: Date;
    equipo: string | null;
    estado: string;
}