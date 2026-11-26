import { Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn } from 'typeorm';

@Entity('caso_estudio')
export class CasoEstudio {
    @PrimaryColumn() id: number;
    @Column() nombre: string;
    @Column({ name: 'modelo_version' }) modeloVersion: string;
}

@Entity('escenario')
export class Escenario {
    @PrimaryGeneratedColumn() id: number;
    @Column({ name: 'caso_id' }) casoId: number;
    @ManyToOne(() => CasoEstudio, { onDelete: 'RESTRICT' }) @JoinColumn({ name: 'caso_id' }) caso: CasoEstudio;
    @Column({ type: 'varchar', length: 20 }) tipo: string;            // NORMAL | ESTRES | MAL_CONDICIONADO
    @Column({ name: 'parametros_json', type: 'jsonb' }) parametrosJson: any;
    @Column({ name: 'fuente_datos' }) fuenteDatos: string;
}

@Entity('simulacion')
export class Simulacion {
    @PrimaryGeneratedColumn() id: number;
    @Column({ name: 'escenario_id' }) escenarioId: number;
    @ManyToOne(() => Escenario, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'escenario_id' }) escenario: Escenario;
    @CreateDateColumn() fecha: Date;
    @Column({ type: 'varchar', nullable: true }) equipo: string | null;
    @Column({ default: 'COMPLETADA' }) estado: string;
    @Column({ name: 'conclusion_numerica', type: 'text' }) conclusionNumerica: string;
    @Column({ name: 'conclusion_problema', type: 'text' }) conclusionProblema: string;
}

@Entity('ejecucion_metodo')
export class EjecucionMetodo {
    @PrimaryGeneratedColumn() id: number;
    @Column({ name: 'simulacion_id' }) simulacionId: number;
    @ManyToOne(() => Simulacion, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'simulacion_id' }) simulacion: Simulacion;
    @Column() metodo: string;
    @Column() familia: string;
    @Column({ type: 'double precision', nullable: true }) tolerancia: number | null;
    @Column({ type: 'double precision', nullable: true }) paso: number | null;
    @Column({ name: 'max_iter', type: 'int', nullable: true }) maxIter: number | null;
    @Column() convergio: boolean;
    @Column({ name: 'tiempo_ms', type: 'double precision' }) tiempoMs: number;
}

@Entity('iteracion_resultado')
export class IteracionResultado {
    @PrimaryGeneratedColumn() id: number;
    @Index() @Column({ name: 'ejecucion_id' }) ejecucionId: number;
    @ManyToOne(() => EjecucionMetodo, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'ejecucion_id' }) ejecucion: EjecucionMetodo;
    @Column() numero: number;
    @Column({ name: 'aproximacion_json', type: 'jsonb' }) aproximacionJson: any;
    @Column({ type: 'double precision', nullable: true }) residual: number | null;
    @Column({ name: 'error_abs', type: 'double precision', nullable: true }) errorAbs: number | null;
    @Column({ name: 'error_rel', type: 'double precision', nullable: true }) errorRel: number | null;
}

@Entity('resultado_resumen')
export class ResultadoResumen {
    @PrimaryGeneratedColumn() id: number;
    @Column({ name: 'ejecucion_id' }) ejecucionId: number;
    @ManyToOne(() => EjecucionMetodo, { onDelete: 'CASCADE' }) @JoinColumn({ name: 'ejecucion_id' }) ejecucion: EjecucionMetodo;
    @Column({ type: 'double precision', nullable: true }) referencia: number | null;
    @Column({ name: 'valor_json', type: 'jsonb' }) valorJson: any;
    @Column({ name: 'metrica_error_json', type: 'jsonb' }) metricaErrorJson: any;
    @Column({ type: 'text' }) interpretacion: string;
}