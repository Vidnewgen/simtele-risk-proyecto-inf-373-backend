import { DomainValidationError } from '../../domain/errors/domain.errors';
import { absErr, pctErr, relErr } from '../../domain/math/errors';
import { rk } from '../../domain/math/numerical';
import { bisection, newton, secant } from '../../domain/math/roots';
import { EngineOutput, IterationRow, MethodRun, ModuleEngine, Params, ScenarioType } from '../../domain/models/simulation.types';
import { fmt, integrationRuns, rootRun, timed } from './run-builders';

export class Module1Engine implements ModuleEngine {
    readonly moduleId = 1 as const;
    readonly nombre = 'Detención de emergencia';

    defaultParams(s: ScenarioType): Params {
        switch (s) {
            case 'NORMAL': return { perfil: 'constante', v0: 11, a: 1.2, tReaccion: 1, distDisponible: 80, m: 6, tol: 1e-10, maxIter: 200 };
            case 'ESTRES': return { perfil: 'constante', v0: 16, a: 0.8, tReaccion: 2, distDisponible: 60, m: 3, tol: 1e-10, maxIter: 200 };
            default: return { perfil: 'cubico', v0: 11, T: 9.17, tReaccion: 1, distDisponible: 80, m: 5, tol: 1e-8, maxIter: 200 };
        }
    }

    run(_s: ScenarioType, p: Params): EngineOutput {
        const { v0, tReaccion, distDisponible, m, tol, maxIter } = p;
        if (!(v0 > 0) || tReaccion < 0 || !(distDisponible > 0)) throw new DomainValidationError('v0>0, tReaccion>=0, distDisponible>0');
        if (!Number.isInteger(m) || m < 2 || m > 12) throw new DomainValidationError('m (n = 2^m subintervalos) debe ser entero entre 2 y 12');
        const cub = p.perfil === 'cubico';
        if (!cub && !(p.a > 0)) throw new DomainValidationError('a>0');
        if (cub && !(p.T > 0)) throw new DomainValidationError('T>0');

        // Modelo: x' = v ; v' = -a(t)
        const tStop = cub ? p.T : v0 / p.a;
        const distRef = cub ? (v0 * p.T) / 4 : (v0 * v0) / (2 * p.a);
        const vF = (t: number) => (cub ? v0 * (1 - t / p.T) ** 3 : v0 - p.a * t);
        const dv = (t: number) => (cub ? (-3 * v0 * (1 - t / p.T) ** 2) / p.T : -p.a);
        const xF = (t: number) => (cub ? (v0 * p.T / 4) * (1 - (1 - t / p.T) ** 4) : v0 * t - (p.a / 2) * t * t);
        const rhs = (t: number, y: number[]) => [y[1], dv(t)];
        const N = 2 ** m;
        const h = tStop / N;
        const methods: MethodRun[] = [];

        // --- EDO RK2 / RK4 ---
        for (const order of [2, 4] as const) {
            const { r, ms } = timed(() => rk(rhs, [0, v0], 0, tStop, N, order));
            const iteraciones: IterationRow[] = r.t.map((t, i) => ({
                numero: i, aproximacion: { t, x: r.y[i][0], v: r.y[i][1] },
                residual: absErr(r.y[i][1], vF(t)), errorAbs: absErr(r.y[i][0], xF(t)), errorRel: relErr(r.y[i][0], xF(t)),
            }));
            const xe = r.y[N][0];
            methods.push({
                metodo: order === 2 ? 'RK2 (punto medio)' : 'RK4', familia: 'EDO', tolerancia: null, paso: h, maxIter: N, convergio: true, tiempoMs: ms, iteraciones,
                resumen: {
                    referencia: distRef, valor: { distanciaFrenado: xe, vFinal: r.y[N][1], tDetencion: tStop },
                    metricaError: { errAbs: absErr(xe, distRef), errRel: relErr(xe, distRef), errPct: pctErr(xe, distRef), errMaxX: Math.max(...iteraciones.map(i => i.errorAbs ?? 0)) },
                    interpretacion: order === 2 ? 'Error global O(h²).' : 'Error global O(h⁴).',
                },
            });
        }

        // --- Integración de v(t): distancia de frenado ---
        const ys = Array.from({ length: N + 1 }, (_, i) => vF(i * h));
        methods.push(...integrationRuns(ys, h, distRef, 'distancia = ∫v dt'));

        // --- Raíces: instante v(t)=0 ---
        const dvF = (t: number) => dv(t);
        const b = tStop * 1.5;
        const tb = timed(() => bisection(vF, 0, b, tol, maxIter));
        methods.push(rootRun('Bisección', tb.r, tStop, tol, maxIter, tb.ms, cub ? 'Raíz triple: residuo pequeño pero error en t grande (mal condicionada).' : 'Convergencia lineal garantizada con cambio de signo.'));
        const tn = timed(() => newton(vF, dvF, tStop * 0.1, tol, maxIter));
        methods.push(rootRun('Newton-Raphson', tn.r, tStop, tol, maxIter, tn.ms, cub ? 'Raíz múltiple (m=3): convergencia lineal, razón ≈ 2/3.' : 'Función lineal: converge en 1 paso.'));
        const ts = timed(() => secant(vF, 0, tStop * 0.2, tol, maxIter));
        methods.push(rootRun('Secante', ts.r, tStop, tol, maxIter, ts.ms, 'Sin derivada; orden ≈1.618 en raíces simples.'));

        const dTotal = v0 * tReaccion + distRef;
        const ok = dTotal <= distDisponible;
        const rk2 = methods[0].resumen.metricaError.errAbs, rk4 = methods[1].resumen.metricaError.errAbs;
        const rootErr = tn.r.root !== undefined ? absErr(tn.r.root, tStop) : null;
        return {
            methods,
            conclusionNumerica:
                `Con n=${N} (h=${fmt(h)} s): error en distancia RK2=${fmt(rk2)} m, RK4=${fmt(rk4)} m. ` +
                `Trapecio/Simpson/Romberg refinan con O(h²), O(h⁴) y extrapolación. Raíces: Newton error=${fmt(rootErr)}. ` +
                (cub ? 'La raíz múltiple muestra que residuo bajo ≠ error bajo y que Newton pierde orden cuadrático; no es fallo de convergencia, es mal condicionamiento.' : 'Para a constante el problema es lineal y los errores reflejan solo truncamiento/redondeo.'),
            conclusionProblema:
                `Tiempo de detención ${fmt(tStop)} s; distancia de frenado ${fmt(distRef)} m + reacción ${fmt(v0 * tReaccion)} m = ${fmt(dTotal)} m frente a ${fmt(distDisponible)} m disponibles: ` +
                (ok ? 'cabe dentro del margen (modelo sintético).' : 'EXCEDE la distancia disponible en este escenario hipotético.') +
                ' Dependen de v0², de a y del tiempo de reacción. No puede inferirse comportamiento real del freno, pendiente ni viento.',
        };
    }
}