import { IsBoolean, IsIn, IsObject, IsOptional, IsString } from 'class-validator';

export class RunSimulationDto {
    @IsIn(['NORMAL', 'ESTRES', 'MAL_CONDICIONADO']) scenario: 'NORMAL' | 'ESTRES' | 'MAL_CONDICIONADO';
    @IsOptional() @IsObject() params?: Record<string, any>;
    @IsOptional() @IsString() equipo?: string;
    @IsOptional() @IsBoolean() guardar?: boolean;
}