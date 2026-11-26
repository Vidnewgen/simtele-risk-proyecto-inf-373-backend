import { DomainValidationError } from '../../domain/errors/domain.errors';
import { absErr, relErr } from '../../domain/math/errors';
import { lagrange, lebesgue, naturalSpline, newtonCoefficients, newtonEval } from '../../domain/math/interpolation';
import { EngineOutput, IterationRow, MethodRun, ModuleEngine, Params, ScenarioType } from '../../domain/models/simulation.types';
import { fmt, timed } from './run-builders';

function mulberry32(a: number) {
    return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

export class Module4Engine implements ModuleEngine {
    readonly moduleId = 4 as const;
    readonly nombre = 'Reconstrucción de sensores';

    defaultParams(s: ScenarioType): Params {
        const base = { fn: 'sin', a: 0, b: 2 * Math.PI, n: 9, ruido: 0, semilla: 42, ocultarCada: 3 };
        if (s === 'NORMAL') return base;
        if (s === 'ESTRES') return { ...base, n: 15, ruido: 0.05 };
        return { fn: 'runge', a: -1, b: 1, n: 14, ruido: 0, semilla: 42, ocultarCada: 3 };   // nodos equiespaciados desfavorables
    }

    run(_s: ScenarioType, p: Params): EngineOutput {
        const { fn, a, b, n, ruido, semilla, ocultarCada } = p;
        if (!(b > a) || !Number.isInteger(n) || n < 5 || n > 40 || ruido < 0 || ocultarCada < 2) throw new DomainValidationError('b>a, 5<=n<=40, ruido>=0, ocultarCada>=2');
        const ref = fn === 'runge' ? (t: number) => 1 / (1 + 25 * t * t) : fn === 'exp' ? (t: number) => Math.exp(-t) : Math.sin;
        const rnd = mulberry32(semilla);
        const T = Array.from({ length: n + 1 }, (_, i) => a + (i * (b - a)) / n);
        const Y = T.map(t => ref(t) + ruido * (2 * rnd() - 1));
        const hidden = T.map((_, i) => i).filter(i => i > 0 && i < n && i % ocultarCada === 1);
        const known = T.map((_, i) => i).filter(i => !hidden.includes(i));
        const xs = known.map(i => T[i]), ys = known.map(i => Y[i]);
        const grid = Array.from({ length: 201 }, (_, i) => a + (i * (b - a)) / 200);
        const L = lebesgue(xs, grid);
        const dY = ys.map((_, i) => 1e-3 * (i % 2 ? 1 : -1));            // perturbación determinista 1e-3

        const c = newtonCoefficients(xs, ys), cP = newtonCoefficients(xs, ys.map((v, i) => v + dY[i]));
        const splineP = naturalSpline(xs, ys.map((v, i) => v + dY[i]));
        const spline = naturalSpline(xs, ys);
        const defs: [string, (x: number) => number, (x: number) => number, string][] = [
            ['Lagrange', x => lagrange(xs, ys, x), x => lagrange(xs, ys.map((v, i) => v + dY[i]), x), 'Polinomio único de grado ≤ nº de nodos−1.'],
            ['Newton (diferencias divididas)', x => newtonEval(xs, c, x), x => newtonEval(xs, cP, x), 'Mismo polinomio que Lagrange; difiere solo en redondeo.'],
            ['Spline cúbico natural', spline, splineP, 'Cúbicas por tramos C²; más estable con muchos nodos.'],
        ];

        const methods: MethodRun[] = defs.map(([name, g, gp, note]) => {
            const { r: rows, ms } = timed(() => hidden.map((i, k): IterationRow => {
                const yh = g(T[i]), yr = ref(T[i]);
                return { numero: k + 1, aproximacion: { t: T[i], yHat: yh, yRef: yr }, residual: null, errorAbs: absErr(yh, yr), errorRel: relErr(yh, yr) };
            }));
            const errs = rows.map(r => r.errorAbs!);
            const amp = Math.max(...hidden.map(i => Math.abs(g(T[i]) - gp(T[i])))) / 1e-3;
            return {
                metodo: name, familia: 'INTERPOLACION', tolerancia: null, paso: (b - a) / n, maxIter: null, convergio: true, tiempoMs: ms, iteraciones: rows,
                resumen: {
                    referencia: null,
                    valor: { t: grid, yHat: grid.map(g), yRef: grid.map(ref), nodos: { t: xs, y: ys }, ocultos: hidden.map(i => T[i]) },
                    metricaError: { errMax: Math.max(...errs), rmse: Math.sqrt(errs.reduce((s, e) => s + e * e, 0) / errs.length), amplificacionPerturbacion: amp, lebesgue: name.startsWith('Spline') ? null : L },
                    interpretacion: note,
                },
            };
        });

        const best = [...methods].sort((x, y) => x.resumen.metricaError.errMax! - y.resumen.metricaError.errMax!)[0];
        return {
            methods,
            conclusionNumerica:
                `${known.length} nodos conocidos, ${hidden.length} ocultos. Error máx: ` + methods.map(m => `${m.metodo}=${fmt(m.resumen.metricaError.errMax, 3)}`).join(', ') +
                `. Constante de Lebesgue de los nodos=${fmt(L, 3)}; amplificación de perturbación (pol./spline)=${fmt(methods[0].resumen.metricaError.amplificacionPerturbacion, 3)}/${fmt(methods[2].resumen.metricaError.amplificacionPerturbacion, 3)}. ` +
                (fn === 'runge' ? 'Nodos equiespaciados + Runge: el polinomio oscila en los bordes (fenómeno de Runge, mal condicionamiento), el spline no.' : 'Lagrange y Newton coinciden salvo redondeo.'),
            conclusionProblema:
                `La mejor reconstrucción de los registros faltantes fue ${best.metodo} (error máx ${fmt(best.resumen.metricaError.errMax, 3)}). ` +
                (ruido > 0 ? `Con ruido de ±${ruido} los polinomios de alto grado amplifican la distorsión; conviene suavizar o usar splines. ` : '') +
                'Solo es confiable dentro del rango de nodos y con espaciamiento adecuado; no puede inferirse el comportamiento fuera del intervalo ni eventos entre muestras. Datos sintéticos.',
        };
    }
}