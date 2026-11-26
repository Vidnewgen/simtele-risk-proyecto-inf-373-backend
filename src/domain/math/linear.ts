import { dot, norm2 } from './errors';

export type Matrix = number[][];
export interface LinStep { k: number; x: number[]; residual: number }
export interface LinResult { x: number[]; converged: boolean; steps: LinStep[] }

export const matVec = (A: Matrix, x: number[]) => A.map(r => r.reduce((s, a, j) => s + a * x[j], 0));
export const residualNorm = (A: Matrix, x: number[], b: number[]) =>
    norm2(matVec(A, x).map((v, i) => b[i] - v));

function stationary(A: Matrix, b: number[], tol: number, maxIter: number, gs: boolean): LinResult {
    const n = b.length;
    const x = new Array(n).fill(0);
    const nb = norm2(b) || 1;
    const steps: LinStep[] = [];
    for (let k = 1; k <= maxIter; k++) {
        const old = [...x];
        for (let i = 0; i < n; i++) {
            let s = 0;
            for (let j = 0; j < n; j++) if (j !== i) s += A[i][j] * (gs ? x[j] : old[j]);
            x[i] = (b[i] - s) / A[i][i];
        }
        const r = residualNorm(A, x, b);
        steps.push({ k, x: [...x], residual: r });
        if (!isFinite(r) || r > 1e12) return { x, converged: false, steps };   // divergencia
        if (r / nb < tol) return { x, converged: true, steps };
    }
    return { x, converged: false, steps };
}
export const jacobi = (A: Matrix, b: number[], tol: number, maxIter: number) => stationary(A, b, tol, maxIter, false);
export const gaussSeidel = (A: Matrix, b: number[], tol: number, maxIter: number) => stationary(A, b, tol, maxIter, true);

export function conjugateGradient(A: Matrix, b: number[], tol: number, maxIter: number): LinResult {
    const n = b.length;
    const x = new Array(n).fill(0);
    let r = [...b];
    let p = [...r];
    let rs = dot(r, r);
    const nb = norm2(b) || 1;
    const steps: LinStep[] = [];
    for (let k = 1; k <= maxIter; k++) {
        const Ap = matVec(A, p);
        const pAp = dot(p, Ap);
        if (pAp <= 0) return { x, converged: false, steps };
        const alpha = rs / pAp;
        for (let i = 0; i < n; i++) { x[i] += alpha * p[i]; r[i] -= alpha * Ap[i]; }
        const rsNew = dot(r, r);
        steps.push({ k, x: [...x], residual: residualNorm(A, x, b) });
        if (Math.sqrt(rsNew) / nb < tol) return { x, converged: true, steps };
        p = r.map((ri, i) => ri + (rsNew / rs) * p[i]);
        rs = rsNew;
    }
    return { x, converged: false, steps };
}

export function luSolve(A: Matrix, b: number[]): number[] {
    const n = b.length;
    const M = A.map(r => [...r]);
    const y = [...b];
    for (let k = 0; k < n; k++) {                      // pivoteo parcial
        let p = k;
        for (let i = k + 1; i < n; i++) if (Math.abs(M[i][k]) > Math.abs(M[p][k])) p = i;
        [M[k], M[p]] = [M[p], M[k]];[y[k], y[p]] = [y[p], y[k]];
        for (let i = k + 1; i < n; i++) {
            const l = M[i][k] / M[k][k];
            for (let j = k; j < n; j++) M[i][j] -= l * M[k][j];
            y[i] -= l * y[k];
        }
    }
    const x = new Array(n).fill(0);
    for (let i = n - 1; i >= 0; i--) {
        let s = y[i];
        for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j];
        x[i] = s / M[i][i];
    }
    return x;
}

/** κ2(A) = λmax/λmin para A SPD (potencia directa e inversa). */
export function conditionNumberSPD(A: Matrix): number {
    const n = A.length;
    let v = new Array(n).fill(1 / Math.sqrt(n));
    let lmax = 1;
    for (let i = 0; i < 2000; i++) { const w = matVec(A, v); lmax = norm2(w); v = w.map(a => a / lmax); }
    let u = new Array(n).fill(1 / Math.sqrt(n));
    let inv = 1;
    for (let i = 0; i < 2000; i++) { const w = luSolve(A, u); inv = norm2(w); u = w.map(a => a / inv); }
    return lmax * inv;
}