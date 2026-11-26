import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DomainErrorFilter } from './presentation/filters/domain-error.filters';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.enableCors({ origin: ['http://localhost:5173'] });
  app.useGlobalPipes(new ValidationPipe({ transform: true }));
  app.useGlobalFilters(new DomainErrorFilter());

  const config = new DocumentBuilder()
    .setTitle('SIMTELE-RISK API')
    .setDescription(
      'Backend educativo de métodos numéricos (UMSA, INF-373). ' +
      '4 módulos × 3 escenarios (NORMAL, ESTRES, MAL_CONDICIONADO). Datos sintéticos.',
    )
    .setVersion('1.0')
    .addServer('http://localhost:3001')
    .addTag('Módulos', 'Parámetros por defecto y ejecución de simulaciones')
    .addTag('Historial', 'Buscar, abrir, relanzar y eliminar simulaciones guardadas')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/openapi.json',   // contrato OpenAPI descargable
    yamlDocumentUrl: 'docs/openapi.yaml',
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();