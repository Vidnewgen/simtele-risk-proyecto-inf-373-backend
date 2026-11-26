import { DomainValidationError } from '../../domain/errors/domain.errors';
import { absErr, relErr } from '../../domain/math/errors';
import { rk, simpson } from '../../domain/math/numerical';
import { EngineOutput, IterationRow, MethodRun, ModuleEngine, Params, ScenarioType } from '../../domain/models/simulation.types';
import { fmt, integrationRuns, timed } from './run-builders';

export class Module3Engine implements ModuleEngine {
  readonly moduleId = 3 as const;
  readonly nombre = 'Oscilaciones por viento';

  defaultParams(s: ScenarioType): Params {
    const base = { m: 1500, k: 6000, c: 300, F0: 0, omega: 2, T: 20, pot: 8, x0: 0.2, v0: 0 };
    if (s === 'NORMAL') return base;
    if (s === 'ESTRES') return { ...base, F0: 800, omega: 1.9, T: 40, pot: 7 };
    return { ...base, c: 6, F0: 800, omega: 2, T: 60, pot: 7 };   // casi resonancia, ζ≈0.001
  }

  run(_s: ScenarioType, p: Params): EngineOutput {
    const { m, k, c, F0, omega, T, pot, x0, v0 } = p;
    if (!(m > 0) || !(k > 0) || c < 0 || !(T > 0)) throw new DomainValidationError('m>0, k>0, c>=0, T>0');
    if (!Number.isInteger(pot) || pot < 3 || pot > 12) throw new DomainValidationError('pot entero 3..12 (N = 2^pot)');
    const w0 = Math.sqrt(k / m), zeta = c / (2 * Math.sqrt(k * m));
    if (F0 === 0 && zeta >= 1) throw new DomainValidationError('Para la referencia analítica se requiere ζ<1');

    const mkRhs = (cc: number) => (t: number, y: number[]) => [y[1], (F0 * Math.sin(omega * t) - cc * y[1] - k * y[0]) / m];
    const rhs = mkRhs(c);
    const N = 2 ** pot, FINE = 32, h = T / N;

    // Referencia: analítica si F=0; si no, RK4 con paso h/32 (autoconvergencia justificada).
    let refFine: number[];
    if (F0 === 0) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      const C2 = (v0 + zeta * w0 * x0) / wd;
      refFine = Array.from({ length: N * FINE + 1 }, (_, i) => { const t = (i * T) / (N * FINE); return Math.exp(-zeta * w0 * t) * (x0 * Math.cos(wd * t) + C2 * Math.sin(wd * t)); });
    } else refFine = rk(rhs, [x0, v0], 0, T, N * FINE, 4).y.map(v => v[0]);
    const refX = (i: number) => refFine[i * FINE];
    const refInt = simpson(refFine.map(x => x * x), T / (N * FINE));

    const methods: MethodRun[] = [];
    const xs: Record<number, number[]> = {};
    for (const order of [2, 4] as const) {
      const { r, ms } = timed(() => rk(rhs, [x0, v0], 0, T, N, order));
      xs[order] = r.y.map(v => v[0]);
      const iteraciones: IterationRow[] = r.t.map((t, i) => ({
        numero: i, aproximacion: { t, x: r.y[i][0], v: r.y[i][1] }, residual: null, errorAbs: absErr(r.y[i][0], refX(i)), errorRel: relErr(r.y[i][0], refX(i)),
      }));
      const maxAmp = Math.max(...xs[order].map(Math.abs)), maxRef = Math.max(...refFine.map(Math.abs));
      methods.push({
        metodo: order === 2 ? 'RK2 (punto medio)' : 'RK4', familia: 'EDO', tolerancia: null, paso: h, maxIter: N, convergio: true, tiempoMs: ms, iteraciones,
        resumen: { referencia: maxRef, valor: { amplitudMax: maxAmp }, metricaError: { errMaxX: Math.max(...iteraciones.map(i => i.errorAbs ?? 0)), errAmpMax: absErr(maxAmp, maxRef) }, interpretacion: order === 2 ? 'O(h²): disipación/dispersión numérica visible con h grande.' : 'O(h⁴): preserva amplitud y fase.' },
      });
    }
    const difRK = Math.max(...xs[2].map((v, i) => Math.abs(v - xs[4][i])));

    // Magnitud acumulada ∫x² dt sobre la solución RK4
    methods.push(...integrationRuns(xs[4].map(x => x * x), h, refInt, '∫x² dt (RK4)'));

    // Sensibilidad respecto a c (1e-6 relativo)
    const eps = 1e-6;
    const xp = rk(mkRhs(c * (1 + eps)), [x0, v0], 0, T, N, 4).y.map(v => v[0] ** 2);
    const I0 = simpson(xs[4].map(x => x * x), h), I1 = simpson(xp, h);
    const sens = c > 0 ? (Math.abs(I1 - I0) / I0) / eps : 0;
    methods[1].resumen.metricaError.sensibilidadIntegralC = sens;

    const e2 = methods[0].resumen.metricaError.errMaxX, e4 = methods[1].resumen.metricaError.errMaxX;
    return {
      methods,
      conclusionNumerica:
        `h=${fmt(h)} s (N=${N}). Error máx RK2=${fmt(e2)} m vs RK4=${fmt(e4)} m; diferencia RK2/RK4=${fmt(difRK)} m. ` +
        `Integral ∫x²: Simpson/Romberg convergen más rápido que el trapecio. Sensibilidad relativa de ∫x² ante c: ${fmt(sens)}. ` +
        (F0 === 0 ? 'Referencia analítica subamortiguada.' : 'Referencia: RK4 con h/32 (sin solución cerrada simple).'),
      conclusionProblema:
        `ω0=${fmt(w0)} rad/s, ζ=${fmt(zeta, 4)}. Amplitud máxima ≈ ${fmt(methods[1].resumen.valor.amplitudMax)} m. ` +
        (F0 > 0 ? `El forzamiento (ω=${omega}) ${Math.abs(omega - w0) < 0.15 * w0 ? 'está cerca de resonancia: poco amortiguamiento amplifica la respuesta y la sensibilidad a c' : 'está alejado de resonancia'}. ` : 'Vibración libre: decae según ζω0. ') +
        'Modelo 1-GDL lineal con viento sinusoidal sintético; no representa turbulencia ni geometría real del cable.',
    };
  }
}