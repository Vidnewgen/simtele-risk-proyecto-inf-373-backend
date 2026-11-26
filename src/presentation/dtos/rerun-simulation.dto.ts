import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Min } from 'class-validator';

export class RerunSimulationDto {
    @ApiPropertyOptional({ default: 1e-9, example: 1e-9, description: 'Tolerancia relativa de coincidencia entre lo guardado y lo recalculado' })
    @IsOptional() @IsNumber() @Min(0)
    tolerancia?: number;

    @ApiPropertyOptional({ default: false, description: 'true = guarda el recálculo como una simulación nueva' })
    @IsOptional() @IsBoolean()
    guardarNueva?: boolean;
}