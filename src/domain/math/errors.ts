export const absErr = (a: number, r: number) => Math.abs(a - r);
export const relErr = (a: number, r: number, eps = 1e-12): number | null =>
    Math.abs(r) < eps ? null : Math.abs(a - r) / Math.abs(r);   // sin dividir por cero
export const pctErr = (a: number, r: number): number | null => {
    const e = relErr(a, r);
    return e === null ? null : e * 100;
};
export const norm2 = (v: number[]) => Math.sqrt(v.reduce((s, a) => s + a * a, 0));
export const dot = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * b[i], 0);