# SIMTELE-RISK Backend

API REST en **NestJS + TypeScript + PostgreSQL** para el análisis, simulación y cuantificación de riesgos operativos en sistemas de transporte por cable aéreo (contexto académico inspirado en Mi Teleférico, La Paz; **parámetros sintéticos, estrictamente educativos**).

**Universidad:** Universidad Mayor de San Andrés (UMSA), Carrera de Informática
**Materia:** INF-373 Métodos Numéricos, gestión II/2026
**Docente:** Lic. Brígida Alexandra Carvajal Blanco
**Integrantes:** Mamani Riveros Juan Vidal · Alanoca Ojeda Lenz Abad

---

## 1. ¿Qué es y qué resuelve?

El backend ejecuta en el servidor los cálculos numéricos de los **4 casos de estudio** obligatorios (3 escenarios cada uno: `NORMAL`, `ESTRES`, `MAL_CONDICIONADO`), guarda cada experimento con el **DER exigido por la consigna** y permite **recuperarlo y relanzarlo** para demostrar reproducibilidad.

Es **independiente del frontend**: el Vue (`simtele-risk`) y este proyecto (`simtele-risk-backend`) tienen su propio `package.json`, se versionan y levantan por separado, y se comunican solo por HTTP.

| URL | Descripción |
|---|---|
| `http://localhost:3001/api` | API REST |
| `http://localhost:3001/docs` | Swagger UI |
| `http://localhost:3001/docs/openapi.json` | Contrato OpenAPI (JSON) |
| `http://localhost:3001/docs/openapi.yaml` | Contrato OpenAPI (YAML) |

### Qué cambia respecto a tener solo frontend

| Aspecto | Antes (Vue + PostgREST) | Ahora (Vue + NestJS) |
|---|---|---|
| Dónde se calcula | Navegador | Servidor (única fuente de verdad) |
| Acceso a la BD | PostgREST exponía tablas al cliente | Solo Nest accede a la BD |
| Validación | Solo en la interfaz | En el servidor (`class-validator` + reglas de dominio) |
| Modelo de datos | Instantáneas de ejecuciones | DER completo de la consigna |
| Prueba "guardar → recuperar → repetir" | Manual | Automática con `POST /simulations/:id/rerun` |
| Evidencias | Solo por UI | Reproducibles con Swagger, `curl` o Postman |

---

## 2. Arquitectura (4 capas, igual que el frontend)

```text
simtele-risk-backend/
├── docker-compose.yml          # Solo PostgreSQL + Adminer (Nest corre en tu máquina)
├── .env
├── package.json                # "type": "commonjs"
├── tsconfig.json               # module commonjs, moduleResolution node10, ignoreDeprecations 6.0
└── src/
    ├── main.ts                 # Bootstrap, prefijo /api, CORS, pipes, filtro y Swagger
    ├── app.module.ts           # Inyección de dependencias (puerto → adaptador)
    ├── domain/                 # Núcleo: sin dependencias de Nest ni de la BD
    │   ├── errors/domain.errors.ts
    │   ├── models/simulation.types.ts
    │   ├── repositories/simulation.repository.ts   # Puerto abstracto
    │   └── math/
    │       ├── errors.ts           # absoluto, relativo (sin dividir por cero), %, normas
    │       ├── linear.ts           # Jacobi, Gauss-Seidel, LU, gradiente conjugado, κ(A)
    │       ├── roots.ts            # Bisección, Newton-Raphson, secante
    │       ├── numerical.ts        # Trapecio, Simpson 1/3, Romberg, RK2 (punto medio), RK4
    │       └── interpolation.ts    # Lagrange, Newton DD, spline cúbico natural, Lebesgue
    ├── application/            # Casos de uso y motores
    │   ├── services/
    │   │   ├── run-builders.ts     # Construye MethodRun con errores y residuales
    │   │   ├── module1.engine.ts   # Detención de emergencia
    │   │   ├── module2.engine.ts   # Deterioro y mantenimiento
    │   │   ├── module3.engine.ts   # Oscilaciones por viento
    │   │   ├── module4.engine.ts   # Reconstrucción de sensores
    │   │   └── engine.registry.ts
    │   └── use-cases/
    │       ├── run-simulation.use-case.ts
    │       ├── simulation-history.use-cases.ts     # listar, abrir, borrar
    │       └── rerun-simulation.use-case.ts        # prueba de reproducibilidad
    ├── infrastructure/        # Adaptadores
    │   ├── database/
    │   │   ├── typeorm.config.ts
    │   │   ├── entities/der.entities.ts            # 6 entidades del DER
    │   │   └── migrations/
    │   └── repositories/simulation.typeorm.repository.ts
    └── presentation/          # HTTP
        ├── controllers/modules.controller.ts
        ├── controllers/simulations.controller.ts
        ├── dtos/run-simulation.dto.ts
        ├── dtos/rerun-simulation.dto.ts
        └── filters/domain-error.filter.ts
```

**Regla de dependencias:** `presentation → application → domain ← infrastructure`.
`domain` define `SimulationRepository` (clase abstracta) e `infrastructure` lo implementa con TypeORM; `AppModule` los une con `{ provide: SimulationRepository, useClass: SimulationTypeOrmRepository }`. Cambiar la BD no toca el dominio.

---

## 3. Los 4 módulos y sus escenarios

| Módulo | Métodos | NORMAL | ESTRES | MAL_CONDICIONADO |
|---|---|---|---|---|
| **1. Detención** | RK2, RK4, trapecio, Simpson, Romberg, bisección, Newton, secante | a constante, v0=11 m/s | v0 mayor, a menor, reacción 2 s | Desaceleración cúbica: raíz triple, residuo bajo y error alto |
| **2. Deterioro** | Bisección, Newton, secante, Jacobi, Gauss-Seidel, LU, gradiente conjugado, κ(A) | Matriz diagonal dominante SPD | Más grande, dominancia débil, mantenimiento retrasado | Matriz de Hilbert (κ muy alto) |
| **3. Oscilaciones** | RK2, RK4, trapecio, Simpson, Romberg sobre ∫x² | Vibración libre subamortiguada | Forzamiento cercano a resonancia, T mayor | Casi resonancia, ζ ≈ 0.001 |
| **4. Sensores** | Lagrange, Newton DD, spline cúbico, constante de Lebesgue | sin(t), 9 intervalos | Más nodos con ruido | Función de Runge con nodos equiespaciados |

**Referencias de verificación**
- M1: `t_det = v0/a`, distancia `v0²/(2a)`.
- M2: raíz de la cuadrática `D0 + αt + βt² = Dumbral`; sistemas `A x* = b` con `x*` conocido.
- M3: solución analítica subamortiguada si `F=0`; si no, RK4 con paso `h/32` (autoconvergencia).
- M4: `sin(t)`, `e^(-t)` o Runge, con puntos ocultos para medir el error real.

**Distinción exigida por la consigna:** el escenario MAL_CONDICIONADO es un subexperimento numérico (κ, Lebesgue, raíz múltiple, sensibilidad) y se documenta aparte de la falta de convergencia.

Cada ejecución devuelve `conclusionNumerica` y `conclusionProblema` por separado.

---

## 4. Modelo de datos (DER)

```text
caso_estudio (id, nombre, modelo_version)
   └─< escenario (id, caso_id, tipo, parametros_json, fuente_datos)
         └─< simulacion (id, escenario_id, fecha, equipo, estado,
                         conclusion_numerica, conclusion_problema)
               └─< ejecucion_metodo (id, simulacion_id, metodo, familia, tolerancia,
                                     paso, max_iter, convergio, tiempo_ms)
                     ├─< iteracion_resultado (id, ejecucion_id, numero,
                     │                        aproximacion_json, residual, error_abs, error_rel)
                     └─< resultado_resumen (id, ejecucion_id, referencia,
                                            valor_json, metrica_error_json, interpretacion)
```

Borrar una simulación elimina en cascada escenario, ejecuciones, iteraciones y resúmenes. `NaN` e `Infinity` se convierten en `null` antes de guardar (PostgreSQL no los admite en `jsonb`).

---

## 5. Endpoints

| Método | Ruta | Función |
|---|---|---|
| GET | `/api/modules` | Módulos con parámetros por defecto de los 3 escenarios |
| GET | `/api/modules/:id/defaults/:scenario` | Parámetros de un escenario |
| POST | `/api/modules/:id/run` | Ejecuta y guarda (`guardar:false` solo calcula, `id = null`) |
| GET | `/api/simulations?moduleId=&scenario=&q=` | Historial (máx. 200, más recientes primero) |
| GET | `/api/simulations/:id` | Simulación completa guardada |
| POST | `/api/simulations/:id/rerun` | Relanza y compara con lo guardado |
| DELETE | `/api/simulations/:id` | Elimina en cascada |

`scenario` ∈ `NORMAL | ESTRES | MAL_CONDICIONADO`. Los errores de validación devuelven `400` y los recursos inexistentes `404`.

**Body de `POST /modules/:id/run`**
```json
{ "scenario": "NORMAL", "params": { "v0": 12 }, "equipo": "Grupo 1", "guardar": true }
```
`params` se fusiona sobre los valores por defecto del escenario.

**Forma de la respuesta**
```ts
{
  id, moduleId, scenario, params, fuenteDatos, fecha, equipo, estado,
  conclusionNumerica, conclusionProblema,
  methods: [{
    metodo, familia, tolerancia, paso, maxIter, convergio, tiempoMs,
    iteraciones: [{ numero, aproximacion, residual, errorAbs, errorRel }],
    resumen: { referencia, valor, metricaError, interpretacion }
  }]
}
```

**Qué contiene `aproximacion` según el método**

| Familia | Contenido |
|---|---|
| EDO (M1, M3) | `{ t, x, v }` |
| Raíces | `{ x, fx }` |
| Sistemas lineales | `{ x: number[] }` (se muestrean las primeras 40 iteraciones y luego una de cada 10) |
| Integración | `{ subintervalos, valor }` (una fila por refinamiento) |
| Interpolación (M4) | `{ t, yHat, yRef }` por punto oculto; las curvas completas están en `resumen.valor` |

---

## 6. Puesta en marcha

### Requisitos
Node.js 24, Docker y Docker Compose.

### 1. Base de datos
```sh
docker compose up -d
```
Levanta PostgreSQL 17 (con `healthcheck`) y Adminer (`http://localhost:8080`). **Nest no corre en Docker**: se ejecuta en tu máquina y se conecta a la BD.

### 2. Variables de entorno (`.env`)
```env
PORT=3001
DB_HOST=localhost
DB_PORT=5432        # usa 5433 si tienes otro PostgreSQL en 5432 y cambia también el mapeo en docker-compose
DB_USER=postgres
DB_PASS=postgres
DB_NAME=simtele
DB_SYNC=true
```

### 3. Instalar y ejecutar
```sh
npm install
npm run start:dev
```

### Problemas frecuentes

| Síntoma | Causa y solución |
|---|---|
| `Option 'moduleResolution=node10' is deprecated` | Añadir `"ignoreDeprecations": "6.0"` al `tsconfig.json` |
| Exige `.js` en los imports | `module: commonjs` y `moduleResolution: node10` (no `nodenext`) |
| `exports is not defined in ES module scope` | `package.json` del backend con `"type": "commonjs"` (el del front sigue en `module`) |
| `la autenticación password falló` | Otro PostgreSQL ocupa el 5432: cambiar el puerto (`5433:5432` y `DB_PORT=5433`), o `docker compose down -v` si el volumen se creó con otra clave |

Para limpiar compilaciones antiguas (PowerShell):
```powershell
Remove-Item -Recurse -Force dist, tsconfig.tsbuildinfo -ErrorAction SilentlyContinue
```

---

## 7. Prueba obligatoria de persistencia

```sh
# 1) Ejecutar y guardar
curl.exe -X POST http://localhost:3001/api/modules/2/run -H "Content-Type: application/json" -d "{\"scenario\":\"MAL_CONDICIONADO\",\"equipo\":\"Grupo 1\"}"

# 2) Reiniciar Nest (Ctrl+C y npm run start:dev) y recuperar
curl.exe http://localhost:3001/api/simulations
curl.exe http://localhost:3001/api/simulations/1

# 3) Repetir el cálculo y comparar
curl.exe -X POST http://localhost:3001/api/simulations/1/rerun -H "Content-Type: application/json" -d "{\"tolerancia\":1e-9}"
# → { "coincide": true, "comparaciones": [...] }
```
También puede hacerse desde Swagger en `/docs`.

---

## 8. Migraciones SQL (entregable)

Con `DB_SYNC=true` TypeORM crea las tablas automáticamente (solo desarrollo). Para la entrega:

1. Crear `src/infrastructure/database/data-source.ts` que exporte un `new DataSource({...})` con las mismas entidades y la conexión de `.env`.
2. Generar la migración:
   ```sh
   npx typeorm-ts-node-commonjs migration:generate -d src/infrastructure/database/data-source.ts src/infrastructure/database/migrations/001_der
   ```
3. Poner `DB_SYNC=false` y ejecutar la migración con `migration:run`.

---
