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

## 9. Integración con el frontend Vue

> Esta sección se basa en la estructura del README del frontend (Clean Architecture: `domain`, `application`, `infrastructure`, `presentation`). Ajusta nombres de archivos y componentes a tu código real.

### Idea general
El frontend deja de calcular y de hablar con PostgREST. Pasa a ser un cliente que **pide la simulación al backend y dibuja el resultado**.

```text
Vista (module1.vue …)  →  caso de uso  →  puerto SimteleApiPort  →  adaptador HTTP (fetch)  →  /api (Nest)
```

### Paso 1. Proxy de Vite
`vite.config.ts`:
```ts
server: {
  proxy: {
    '/api': { target: 'http://localhost:3001', changeOrigin: true }   // sin rewrite
  }
}
```
Ejecuta ambos proyectos a la vez: backend (`npm run start:dev`) y frontend (`npm run dev`).

### Paso 2. Quitar PostgREST del frontend
- En el `docker-compose.yml` del front elimina `postgrest` y `postgres` (la BD ahora la levanta el backend). Si dejas ambos, chocarán en el puerto 5432.
- Elimina o archiva `infrastructure/database/postgrest.client.ts`, `module-run.postgrest.adapter.ts` y `module2.postgrest.adapter.ts`.
- Las migraciones SQL del front (`001`…`006`) dejan de usarse: el esquema lo crea TypeORM.

### Paso 3. Tipos de la API
`src/domain/models/api.types.ts`:
```ts
export type ScenarioType = 'NORMAL' | 'ESTRES' | 'MAL_CONDICIONADO'
export type ModuleId = 1 | 2 | 3 | 4

export interface IterationRow {
  numero: number
  aproximacion: Record<string, any>
  residual: number | null
  errorAbs: number | null
  errorRel: number | null
}
export interface MethodRun {
  metodo: string; familia: string
  tolerancia: number | null; paso: number | null; maxIter: number | null
  convergio: boolean; tiempoMs: number
  iteraciones: IterationRow[]
  resumen: { referencia: number | null; valor: any; metricaError: Record<string, number | null>; interpretacion: string }
}
export interface SimulationResult {
  id: number | null
  moduleId: ModuleId
  scenario: ScenarioType
  params: Record<string, any>
  fecha?: string
  equipo?: string | null
  conclusionNumerica: string
  conclusionProblema: string
  methods: MethodRun[]
}
export interface SimulationSummary {
  id: number; moduleId: ModuleId; moduleName: string
  scenario: ScenarioType; fecha: string; equipo: string | null; estado: string
}
export interface ModuleInfo {
  id: ModuleId; nombre: string
  defaults: Record<ScenarioType, Record<string, any>>
}
export interface RerunResult {
  simulacionOriginal: number; tolerancia: number; coincide: boolean
  nuevaSimulacionId: number | null
  comparaciones: { metodo: string; metrica: string; guardado: number; nuevo: number; dif: number; ok: boolean }[]
}
```

### Paso 4. Puerto y adaptador HTTP
`src/application/ports/simtele-api.port.ts`:
```ts
import type { ModuleInfo, ModuleId, RerunResult, ScenarioType, SimulationResult, SimulationSummary } from '@/domain/models/api.types'

export interface SimteleApiPort {
  listModules(): Promise<ModuleInfo[]>
  run(moduleId: ModuleId, body: { scenario: ScenarioType; params?: Record<string, any>; equipo?: string; guardar?: boolean }): Promise<SimulationResult>
  listSimulations(f?: { moduleId?: number; scenario?: string; q?: string }): Promise<SimulationSummary[]>
  getSimulation(id: number): Promise<SimulationResult>
  rerun(id: number, body?: { tolerancia?: number; guardarNueva?: boolean }): Promise<RerunResult>
  deleteSimulation(id: number): Promise<void>
}
```

`src/infrastructure/api/simtele.api.adapter.ts`:
```ts
import type { SimteleApiPort } from '@/application/ports/simtele-api.port'

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: { 'Content-Type': 'application/json' }, ...init })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(Array.isArray(err.message) ? err.message.join(', ') : err.message ?? `HTTP ${res.status}`)
  }
  return res.status === 204 ? (undefined as T) : res.json()
}

export const simteleApi: SimteleApiPort = {
  listModules: () => http('/modules'),
  run: (id, body) => http(`/modules/${id}/run`, { method: 'POST', body: JSON.stringify(body) }),
  listSimulations: (f = {}) => {
    const q = new URLSearchParams(Object.entries(f).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)]))
    return http(`/simulations?${q}`)
  },
  getSimulation: id => http(`/simulations/${id}`),
  rerun: (id, body = {}) => http(`/simulations/${id}/rerun`, { method: 'POST', body: JSON.stringify(body) }),
  deleteSimulation: id => http(`/simulations/${id}`, { method: 'DELETE' }),
}
```

### Paso 5. Casos de uso
`src/application/use-cases/simulation.use-cases.ts` (reemplaza `module1…4.use-cases.ts`, que ahora se reducen a uno genérico):
```ts
import type { SimteleApiPort } from '../ports/simtele-api.port'

export const makeSimulationUseCases = (api: SimteleApiPort) => ({
  loadModules: () => api.listModules(),
  run: api.run,
  history: api.listSimulations,
  open: api.getSimulation,
  rerun: api.rerun,
  remove: api.deleteSimulation,
})
```

### Paso 6. Composable para las vistas
`src/presentation/composables/useModuleSimulation.ts`:
```ts
import { ref } from 'vue'
import { simteleApi } from '@/infrastructure/api/simtele.api.adapter'
import { makeSimulationUseCases } from '@/application/use-cases/simulation.use-cases'
import type { ModuleId, ScenarioType, SimulationResult } from '@/domain/models/api.types'

const uc = makeSimulationUseCases(simteleApi)

export function useModuleSimulation(moduleId: ModuleId) {
  const scenario = ref<ScenarioType>('NORMAL')
  const params = ref<Record<string, any>>({})
  const result = ref<SimulationResult | null>(null)
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadDefaults() {
    const mods = await uc.loadModules()
    params.value = { ...mods.find(m => m.id === moduleId)!.defaults[scenario.value] }
  }
  async function execute(guardar = true) {
    loading.value = true; error.value = null
    try { result.value = await uc.run(moduleId, { scenario: scenario.value, params: params.value, guardar }) }
    catch (e: any) { error.value = e.message }
    finally { loading.value = false }
  }
  async function open(id: number) { result.value = await uc.open(id); scenario.value = result.value.scenario; params.value = result.value.params }

  return { scenario, params, result, loading, error, loadDefaults, execute, open }
}
```

### Paso 7. Usarlo en cada vista
En `module1.vue … module4.vue`:
- Selector de escenario → `scenario`; al cambiar, vuelve a llamar `loadDefaults()`.
- Formulario de parámetros → `params` (las validaciones finales las hace el backend; muestra `error`).
- Botón **Ejecutar** → `execute()`; botón **Calcular sin guardar** → `execute(false)`.
- Tablas → `result.methods[i].iteraciones`; resumen y errores → `resumen.metricaError`.
- Pestaña **Interpretación** → `conclusionNumerica` y `conclusionProblema`, separadas.

### Paso 8. Datos para los gráficos (`LineChart.vue`)
Ayudante para extraer series (adáptalo a las props de tu `LineChart`):
```ts
const method = (r: SimulationResult, name: string) => r.methods.find(m => m.metodo.startsWith(name))!

// M1 y M3 · solución: x(t) de RK4 y RK2
const traj = (r: SimulationResult, name: string) =>
  method(r, name).iteraciones.map(i => ({ x: i.aproximacion.t, y: i.aproximacion.x }))

// Error vs tiempo (M1, M3)
const errT = (r: SimulationResult, name: string) =>
  method(r, name).iteraciones.map(i => ({ x: i.aproximacion.t, y: i.errorAbs }))

// Convergencia de integración: error vs subintervalos (usar escala log)
const conv = (r: SimulationResult, name: string) =>
  method(r, name).iteraciones.map(i => ({ x: i.aproximacion.subintervalos, y: i.errorAbs }))

// M2 · convergencia de iterativos: residual vs iteración
const resid = (r: SimulationResult, name: string) =>
  method(r, name).iteraciones.map(i => ({ x: i.numero, y: i.residual }))

// M4 · curvas superpuestas (referencia, Lagrange, Newton, spline) + nodos y puntos ocultos
const v = method(result, 'Lagrange').resumen.valor   // { t, yHat, yRef, nodos:{t,y}, ocultos }
```

| Módulo | Gráfico 1 (solución) | Gráfico 2 (error/convergencia) |
|---|---|---|
| 1 | x(t) y v(t), RK2 vs RK4 | Error vs h (integración) y error de raíz por iteración |
| 2 | Raíz t* por método | Residual vs iteración (Jacobi, GS, CG) |
| 3 | x(t) RK2 vs RK4 | Error vs tiempo y convergencia de ∫x² |
| 4 | Curvas superpuestas + nodos | Error en puntos ocultos por método |

### Paso 9. Vista de Historial
- Listado: `uc.history({ moduleId, scenario, q })` → tabla de `SimulationSummary`.
- **Abrir:** `uc.open(id)` y reutiliza la vista del módulo (`open(id)` del composable).
- **Relanzar:** `uc.rerun(id)` y muestra `coincide` y `comparaciones`.
- **Eliminar:** `uc.remove(id)`.
- Es el requisito de la consigna "Buscar, abrir, visualizar y relanzar al menos una simulación".

### Paso 10. Qué hacer con el motor del frontend
- No lo uses para las pantallas: sería doble cálculo y los números podrían diferir.
- Puedes conservar `domain/math/` y sus pruebas como **contraste**: compara sus resultados con los del backend y úsalo como evidencia de verificación en el informe.
- Si vas a retirarlo, borra `module1…4.engine.ts` y los puertos antiguos solo después de que las vistas funcionen con la API.

### Checklist de integración
- [ ] Backend corriendo en `:3001` y `GET /api/modules` responde.
- [ ] Proxy `/api` configurado y PostgREST/BD del front eliminados.
- [ ] `api.types.ts`, puerto, adaptador, casos de uso y composable creados.
- [ ] Las 4 vistas llaman a `execute()` y pintan tablas y 2 gráficos.
- [ ] Interpretación con las dos conclusiones separadas.
- [ ] Historial: buscar, abrir, relanzar, eliminar.
- [ ] Prueba: ejecutar → reiniciar backend → abrir desde historial → `rerun` con `coincide: true`.

---

## 10. Cumplimiento de la consigna

| Requisito | Dónde está |
|---|---|
| Errores transversales | `domain/math/errors.ts` y `metricaError` en todos los módulos |
| Jacobi, GS, LU, CG, κ(A), SPD | `domain/math/linear.ts`, Módulo 2 |
| Lagrange, Newton DD, spline, Lebesgue | `domain/math/interpolation.ts`, Módulo 4 |
| Bisección, Newton, secante | `domain/math/roots.ts`, Módulos 1 y 2 |
| Trapecio, Simpson, Romberg | `domain/math/numerical.ts`, Módulos 1 y 3 |
| RK2 (punto medio, variante declarada) y RK4 | `rk()` en `numerical.ts`, Módulos 1 y 3 |
| 3 escenarios × 4 módulos | `defaultParams()` en cada motor |
| MAL_CONDICIONADO ≠ no convergencia | Hilbert (M2), raíz triple (M1), cuasi-resonancia (M3), Runge (M4) |
| Conclusión numérica y del problema | Campos separados en cada respuesta y en la tabla `simulacion` |
| DER, guardado, recuperación y relanzado | `der.entities.ts`, repositorio TypeORM, `RerunSimulationUseCase` |

---

## 11. Limitaciones y pendientes

- El motor del backend se escribió de forma independiente y **aún no se ha contrastado con el del frontend**; conviene escribir pruebas con Vitest sobre casos analíticos (`v0²/(2a)`, cuadrática de D(t), `sin(t)`).
- `DB_SYNC=true` es solo para desarrollo; la entrega requiere migraciones.
- Las respuestas de Swagger no tienen esquema detallado (los objetos son dinámicos).
- Sin autenticación: `equipo` es solo informativo.
- Los modelos son sintéticos y educativos, sin conexión con equipos reales.

---

## Stack

| Capa | Tecnología |
|---|---|
| Backend | NestJS + TypeScript (CommonJS) |
| ORM | TypeORM |
| Validación | class-validator, class-transformer |
| Documentación | @nestjs/swagger (OpenAPI 3) |
| Base de datos | PostgreSQL 17 (Docker) |
| Admin BD | Adminer |
| Pruebas | Vitest |