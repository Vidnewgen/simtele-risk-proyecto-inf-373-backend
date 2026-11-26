export interface RootStep { k: number; x: number; fx: number }
export interface RootResult { root: number; converged: boolean; steps: RootStep[] }
type F = (t: number) => number;

export function bisection(f: F, a: number, b: number, tol: number, maxIter: number): RootResult {
    const steps: RootStep[] = [];
    let fa = f(a);
    if (fa * f(b) > 0) return { root: NaN, converged: false, steps };
    let c = a;
    for (let k = 1; k <= maxIter; k++) {
        c = (a + b) / 2;
        const fc = f(c);
        steps.push({ k, x: c, fx: fc });
        if (Math.abs(fc) < tol || (b - a) / 2 < tol) return { root: c, converged: true, steps };
        if (fa * fc < 0) b = c; else { a = c; fa = fc; }
    }
    return { root: c, converged: false, steps };
}

export function newton(f: F, df: F, x0: number, tol: number, maxIter: number): RootResult {
    const steps: RootStep[] = [];
    let x = x0;
    for (let k = 1; k <= maxIter; k++) {
        const fx = f(x);
        steps.push({ k, x, fx });
        if (Math.abs(fx) < tol) return { root: x, converged: true, steps };
        const d = df(x);
        if (Math.abs(d) < 1e-14) return { root: x, converged: false, steps };   // derivada ~0
        x = x - fx / d;
    }
    return { root: x, converged: false, steps };
}

export function secant(f: F, x0: number, x1: number, tol: number, maxIter: number): RootResult {
    const steps: RootStep[] = [];
    let a = x0, b = x1, fa = f(a), fb = f(b);
    for (let k = 1; k <= maxIter; k++) {
        steps.push({ k, x: b, fx: fb });
        if (Math.abs(fb) < tol) return { root: b, converged: true, steps };
        if (fb === fa) return { root: b, converged: false, steps };
        const c = b - fb * (b - a) / (fb - fa);
        a = b; fa = fb; b = c; fb = f(b);
    }
    return { root: b, converged: false, steps };
}