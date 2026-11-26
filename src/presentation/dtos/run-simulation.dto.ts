import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export const SCENARIOS = ['NORMAL', 'ESTRES', 'MAL_CONDICIONADO'] as const;
export type ScenarioDto = (typeof SCENARIOS)[number];

export class RunSimulationDto {
    @ApiProperty({ enum: SCENARIOS, example: 'NORMAL', description: 'Escenario experimental' })
    @IsIn(SCENARIOS as unknown as string[])
    scenario: ScenarioDto;

    @ApiPropertyOptional({
        type: 'object',
        additionalProperties: true,
        example: { v0: 12, a: 1.1 },
        description: 'Parámetros que sobrescriben los valores por defecto del escenario. Si se omite, se usan los por defecto.',
    })
    @IsOptional() @IsObject()
    params?: Record<string, any>;

    @ApiPropertyOptional({ example: 'Grupo 1', description: 'Usuario o equipo (opcional)' })
    @IsOptional() @IsString()
    equipo?: string;

    @ApiPropertyOptional({ default: true, description: 'false = calcula sin guardar en la base de datos' })
    @IsOptional() @IsBoolean()
    guardar?: boolean;
}