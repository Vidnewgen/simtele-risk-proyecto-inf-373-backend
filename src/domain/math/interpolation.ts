import { luSolve } from './linear';

export function lagrange(xs: number[], ys: number[], x: number): number {
    let s = 0;
    for (let i = 0; i < xs.length; i++) {
        let l = 1;
        for (let j = 0; j < xs.length; j++) if (j !== i) l *= (x - xs[j]) / (xs[i] - xs[j]);
        s += ys[i] * l;
    }
    return s;
}

export function newtonCoefficients(xs: number[], ys: number[]): number[] {
    const c = [...ys];
    for (let j = 1; j < xs.length; j++)
        for (let i = xs.length - 1; i >= j; i--) c[i] = (c[i] - c[i - 1]) / (xs[i] - xs[i - j]);
    return c;
}
export function newtonEval(xs: number[], c: number[], x: number): number {
    let r = c[c.length - 1];
    for (let i = c.length - 2; i >= 0; i--) r = r * (x - xs[i]) + c[i];
    return r;
}

/** Spline cúbico natural (M0 = Mn = 0), nodos no necesariamente equiespaciados. */
export function naturalSpline(xs: number[], ys: number[]) {
    const n = xs.length;
    const h = xs.slice(1).map((x, i) => x - xs[i]);
    const A = Array.from({ length: n }, () => new Array(n).fill(0));
    const r = new Array(n).fill(0);
    A[0][0] = 1; A[n - 1][n - 1] = 1;
    for (let i = 1; i < n - 1; i++) {
        A[i][i - 1] = h[i - 1]; A[i][i] = 2 * (h[i - 1] + h[i]); A[i][i + 1] = h[i];
        r[i] = 6 * ((ys[i + 1] - ys[i]) / h[i] - (ys[i] - ys[i - 1]) / h[i - 1]);
    }
    const M = luSolve(A, r);
    return (x: number): number => {
        let i = xs.findIndex((v, k) => k < n - 1 && x >= v && x <= xs[k + 1]);
        if (i < 0) i = x < xs[0] ? 0 : n - 2;
        const hi = h[i];
        return (M[i] * (xs[i + 1] - x) ** 3) / (6 * hi) + (M[i + 1] * (x - xs[i]) ** 3) / (6 * hi)
            + (ys[i] / hi - (M[i] * hi) / 6) * (xs[i + 1] - x)
            + (ys[i + 1] / hi - (M[i + 1] * hi) / 6) * (x - xs[i]);
    };
}

/** Constante de Lebesgue: amplificación máxima del error de los datos (evidencia de mal condicionamiento). */
export function lebesgue(xs: number[], grid: number[]): number {
    let L = 0;
    for (const x of grid) {
        let s = 0;
        for (let i = 0; i < xs.length; i++) {
            let l = 1;
            for (let j = 0; j < xs.length; j++) if (j !== i) l *= (x - xs[j]) / (xs[i] - xs[j]);
            s += Math.abs(l);
        }
        L = Math.max(L, s);
    }
    return L;
}