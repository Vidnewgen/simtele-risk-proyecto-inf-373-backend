import { absErr, norm2, pctErr, relErr } from '../../domain/math/errors';
import { LinResult, Matrix, residualNorm } from '../../domain/math/linear';
import { RootResult } from '../../domain/math/roots';
import { decimate, romberg, simpson, trapezoid } from '../../domain/math/numerical';
import { IterationRow, MethodRun } from '../../domain/models/simulation.types';

export const timed = <T>(fn: () => T) => {
    const t0 = performance.now();
    const r = fn();
    return { r, ms: performance.now() - t0 };
};

export function thin<T>(a: T[], head = 40, every = 10): T[] {
    return a.filter((_, i) => i < head || i % every === 0 || i === a.length - 1);
}

export function rootRun(metodo: string, res: RootResult, ref: number, tol: number, maxIter: number, ms: number, interpretacion: string): MethodRun {
    const iteraciones: IterationRow[] = res.steps.map(s => ({
        numero: s.k, aproximacion: { x: s.x, fx: s.fx },
        residual: Math.abs(s.fx), errorAbs: absErr(s.x, ref), errorRel: relErr(s.x, ref),
    }));
    return {
        metodo, familia: 'RAICES', tolerancia: tol, paso: null, maxIter, convergio: res.converged, tiempoMs: ms, iteraciones,
        resumen: {
            referencia: ref, valor: { raiz: res.root, iteraciones: res.steps.length },
            metricaError: { errAbs: absErr(res.root, ref), errRel: relErr(res.root, ref), errPct: pctErr(res.root, ref), residual: res.steps.length ? Math.abs(res.steps[res.steps.length - 1].fx) : null },
            interpretacion,
        },
    };
}

export function linearRun(metodo: string, res: LinResult, A: Matrix, b: number[], xTrue: number[], tol: number, maxIter: number, ms: number, kappa: number, interpretacion: string): MethodRun {
    const nx = norm2(xTrue);
    const err = (x: number[]) => norm2(x.map((v, i) => v - xTrue[i]));
    const iteraciones: IterationRow[] = thin(res.steps).map(s => ({
        numero: s.k, aproximacion: { x: s.x }, residual: s.residual, errorAbs: err(s.x), errorRel: err(s.x) / nx,
    }));
    const eAbs = err(res.x);
    return {
        metodo, familia: 'SISTEMAS_LINEALES', tolerancia: tol, paso: null, maxIter, convergio: res.converged, tiempoMs: ms, iteraciones,
        resumen: {
            referencia: nx, valor: { x: res.x, iteraciones: res.steps.length },
            metricaError: { errAbs: eAbs, errRel: eAbs / nx, residual: residualNorm(A, res.x, b), kappa, iteraciones: res.steps.length },
            interpretacion,
        },
    };
}

/** Trapecio y Simpson (refinamiento por decimación) + Romberg sobre muestras con n = 2^m. */
export function integrationRuns(y: number[], h: number, ref: number, label: string): MethodRun[] {
    const n = y.length - 1;
    const L = Math.round(Math.log2(n));
    const mk = (metodo: string, rows: { n: number; v: number }[], interp: string): MethodRun => {
        const last = rows[rows.length - 1];
        return {
            metodo, familia: 'INTEGRACION', tolerancia: null, paso: h, maxIter: null, convergio: true, tiempoMs: 0,
            iteraciones: rows.map((r, i) => ({ numero: i + 1, aproximacion: { subintervalos: r.n, valor: r.v }, residual: null, errorAbs: absErr(r.v, ref), errorRel: relErr(r.v, ref) })),
            resumen: { referencia: ref, valor: { integral: last.v, magnitud: label }, metricaError: { errAbs: absErr(last.v, ref), errRel: relErr(last.v, ref), errPct: pctErr(last.v, ref) }, interpretacion: interp },
        };
    };
    const trap: { n: number; v: number }[] = [];
    const simp: { n: number; v: number }[] = [];
    for (let i = 1; i <= L; i++) {
        const stride = n / 2 ** i;
        const ys = decimate(y, stride);
        trap.push({ n: 2 ** i, v: trapezoid(ys, h * stride) });
        if (i >= 1) simp.push({ n: 2 ** i, v: simpson(ys, h * stride) });
    }
    const R = romberg(y, h);
    const romb = R.map((row, i) => ({ n: 2 ** i, v: row[i] })).slice(1);
    return [
        mk('Trapecio compuesto', trap, 'Error O(h²): al duplicar n el error cae ≈4×.'),
        mk('Simpson 1/3 compuesto', simp, 'Error O(h⁴): al duplicar n el error cae ≈16×; exacto para polinomios de grado ≤3.'),
        mk('Romberg', romb, 'Extrapolación de Richardson sobre el trapecio: alta precisión con pocas evaluaciones.'),
    ];
}

export const fmt = (x: number | null | undefined, d = 4) =>
    x === null || x === undefined || !isFinite(x) ? 'n/d' : Math.abs(x) < 1e-3 || Math.abs(x) >= 1e5 ? x.toExponential(d - 1) : x.toFixed(d);