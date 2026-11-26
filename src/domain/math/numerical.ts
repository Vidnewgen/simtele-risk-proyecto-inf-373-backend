// Integración sobre muestras equiespaciadas (n = 2^m subintervalos) y EDO.
export const decimate = (y: number[], stride: number) => y.filter((_, i) => i % stride === 0);

export function trapezoid(y: number[], h: number): number {
    const n = y.length - 1;
    let s = (y[0] + y[n]) / 2;
    for (let i = 1; i < n; i++) s += y[i];
    return s * h;
}

export function simpson(y: number[], h: number): number {
    const n = y.length - 1;
    if (n % 2 !== 0) throw new Error('Simpson 1/3 requiere n par');
    let s = y[0] + y[n];
    for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * y[i];
    return (s * h) / 3;
}

/** Romberg: devuelve la tabla R[i][j]; la mejor aproximación es la diagonal. */
export function romberg(y: number[], h: number): number[][] {
    const n = y.length - 1;
    const L = Math.round(Math.log2(n));
    if (2 ** L !== n) throw new Error('Romberg requiere n = 2^L');
    const R: number[][] = [];
    for (let i = 0; i <= L; i++) {
        const stride = n / 2 ** i;
        R[i] = [trapezoid(decimate(y, stride), h * stride)];
        for (let j = 1; j <= i; j++) R[i][j] = (4 ** j * R[i][j - 1] - R[i - 1][j - 1]) / (4 ** j - 1);
    }
    return R;
}

export type Rhs = (t: number, y: number[]) => number[];
const axpy = (y: number[], a: number, k: number[]) => y.map((v, i) => v + a * k[i]);

/** order 2 = punto medio (variante declarada); order 4 = RK4 clásico. */
export function rk(f: Rhs, y0: number[], t0: number, t1: number, n: number, order: 2 | 4) {
    const h = (t1 - t0) / n;
    const t = [t0];
    const Y = [y0];
    let y = y0;
    for (let i = 0; i < n; i++) {
        const ti = t0 + i * h;
        if (order === 2) {
            const k1 = f(ti, y);
            y = axpy(y, h, f(ti + h / 2, axpy(y, h / 2, k1)));
        } else {
            const k1 = f(ti, y);
            const k2 = f(ti + h / 2, axpy(y, h / 2, k1));
            const k3 = f(ti + h / 2, axpy(y, h / 2, k2));
            const k4 = f(ti + h, axpy(y, h, k3));
            y = y.map((v, j) => v + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
        }
        t.push(t0 + (i + 1) * h);
        Y.push(y);
    }
    return { t, y: Y, h };
}