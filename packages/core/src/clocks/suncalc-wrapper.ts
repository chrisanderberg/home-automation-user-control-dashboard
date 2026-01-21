/**
 * Wrapper for suncalc to handle CommonJS import in ESM environment.
 * Uses ESM import syntax that works with modern bundlers (including Convex's esbuild).
 */
// @ts-ignore - suncalc is CommonJS but bundlers can handle this
import suncalc from 'suncalc';

export const getTimes = suncalc.getTimes.bind(suncalc);
