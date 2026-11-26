import { DomainValidationError } from '../../domain/errors/domain.errors';
import { absErr } from '../../domain/math/errors';
import { conditionNumberSPD, conjugateGradient, gaussSeidel, jacobi, LinResult, luSolve, matVec, Matrix } from '../../domain/math/linear';
import { bisection, newton, secant } from '../../domain/math/roots';
import { EngineOutput, MethodRun, ModuleEngine, Params, ScenarioType } from '../../domain/models/simulation.types';
import { fmt, linearRun, rootRun, timed } from './run-builders';

function buildMatrix(kind: string, n: number): Matrix {
    return Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => {
        if (kind === 'hilbert') return 1 / (i + j + 1);
        const d = kind === 'dominante' ? 4 : 2;           // SPD en ambos casos
        return i === j ? d : Math.abs(i - j) === 1 ? -1 : 0;
    }));
}
function positiveRoot(a: number, b: number, c: number): number {
    if (Math.abs(a) < 1e-14) return -c / b;
    const disc = b * b - 4 * a * c;
    if (disc < 0) throw new DomainValidationError('La cuadrática no tiene raíz real');
    const r = [(-b + Math.sqrt(disc)) / (2 * a), (-b - Math.sqrt(disc)) / (2 * a)].filter(x => x >= 0).sort((x, y) => x - y);
    if (!r.length) throw new DomainValidationError('No hay raíz físicamente admisible (t>=0)');
    return r[0];
}

export class Module2Engine implements ModuleEngine {
    readonly moduleId = 2 as const;
    readonly nombre = 'Deterioro mecánico y mantenimiento';

    defaultParams(s: ScenarioType): Params {
        const base = { D0: 0.1, alpha: 0.02, beta: 0.0004, Dumbral: 1, retrasoDias: 0, tolRaiz: 1e-10, tol: 1e-10, maxIter: 1000 };
        if (s === 'NORMAL') return { ...base, n: 5, matriz: 'dominante' };
        if (s === 'ESTRES') return { ...base, alpha: 0.05, beta: 0.001, retrasoDias: 15, n: 8, matriz: 'debil', maxIter: 5000 };
        return { ...base, n: 6, matriz: 'hilbert', maxIter: 5000 };
    }

    run(_s: ScenarioType, p: Params): EngineOutput {
        const { D0, alpha, beta, Dumbral, retrasoDias, n, matriz, tol, tolRaiz, maxIter } = p;
        if (!(D0 < Dumbral) || !(alpha > 0) || beta < 0) throw new DomainValidationError('Requiere D0 < Dumbral, alpha>0, beta>=0');
        if (!Number.isInteger(n) || n < 4 || n > 12) throw new DomainValidationError('n entero entre 4 y 12');
        if (!['dominante', 'debil', 'hilbert'].includes(matriz)) throw new DomainValidationError('matriz inválida');

        const f = (t: number) => D0 + alpha * t + beta * t * t - Dumbral;
        const df = (t: number) => alpha + 2 * beta * t;
        const tRef = positiveRoot(beta, alpha, D0 - Dumbral);
        const methods: MethodRun[] = [];

        const tb = timed(() => bisection(f, 0, 3 * tRef + 1, tolRaiz, maxIter));
        methods.push(rootRun('Bisección', tb.r, tRef, tolRaiz, maxIter, tb.ms, 'Robusta; requiere cambio de signo.'));
        const tn = timed(() => newton(f, df, 0, tolRaiz, maxIter));
        methods.push(rootRun('Newton-Raphson', tn.r, tRef, tolRaiz, maxIter, tn.ms, 'Cuadrática cerca de raíz simple (D\'(t*)≠0).'));
        const ts = timed(() => secant(f, 0, tRef * 0.5 + 1, tolRaiz, maxIter));
        methods.push(rootRun('Secante', ts.r, tRef, tolRaiz, maxIter, ts.ms, 'Superlineal sin derivada.'));

        // Sensibilidad de t* ante alpha (perturbación relativa 1e-6)
        const eps = 1e-6;
        const tPert = positiveRoot(beta, alpha * (1 + eps), D0 - Dumbral);
        const sens = (Math.abs(tPert - tRef) / tRef) / eps;

        // Sistema lineal SPD  A x* = b
        const A = buildMatrix(matriz, n);
        const xTrue = Array.from({ length: n }, (_, i) => i + 1);
        const b = matVec(A, xTrue);
        const kappa = conditionNumberSPD(A);
        const runs: [string, () => LinResult, string][] = [
            ['Jacobi', () => jacobi(A, b, tol, maxIter), 'Converge si ρ(D⁻¹(L+U))<1 (p.ej. diagonal dominante).'],
            ['Gauss-Seidel', () => gaussSeidel(A, b, tol, maxIter), 'Converge para SPD; ≈2× más rápido que Jacobi.'],
            ['LU (pivoteo parcial)', () => ({ x: luSolve(A, b), converged: true, steps: [{ k: 1, x: luSolve(A, b), residual: 0 }] }), 'Directo: error ≈ κ(A)·ε_máq.'],
            ['Gradiente conjugado', () => conjugateGradient(A, b, tol, maxIter), 'Requiere SPD; ≤n pasos en aritmética exacta.'],
        ];
        const lin: MethodRun[] = runs.map(([name, fn, note]) => {
            const { r, ms } = timed(fn);
            return linearRun(name, r, A, b, xTrue, tol, maxIter, ms, kappa, note);
        });
        methods.push(...lin);

        const noConv = lin.filter(l => !l.convergio).map(l => l.metodo);
        const delta = tRef - retrasoDias;
        return {
            methods,
            conclusionNumerica:
                `κ(A)=${fmt(kappa, 3)} (${matriz}). Errores relativos: ` + lin.map(l => `${l.metodo}=${fmt(l.resumen.metricaError.errRel, 3)}`).join(', ') + '. ' +
                (noConv.length ? `No convergieron: ${noConv.join(', ')} (divergencia/lentitud por el espectro, distinta de mal condicionamiento). ` : 'Todos los iterativos convergieron. ') +
                `Raíz: error Newton=${fmt(absErr(tn.r.root, tRef))}; sensibilidad d(t*)/d(α) relativa=${fmt(sens)}.`,
            conclusionProblema:
                `El indicador alcanza el umbral en t*≈${fmt(tRef)} (unidades de tiempo del modelo). Con mantenimiento retrasado ${retrasoDias} u.t., ` +
                (delta > 0 ? `quedan ${fmt(delta)} u.t. de margen.` : `la inspección se pasaría del umbral por ${fmt(-delta)} u.t.`) +
                ' El parámetro α domina la estimación al inicio y β a tiempos largos. El modelo D(t) es hipotético: no predice fallos reales.',
        };
    }
}