/**
 * Wrapper for suncalc to handle CommonJS import in ESM environment.
 */
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const suncalc = require('suncalc');

export const getTimes = suncalc.getTimes.bind(suncalc);
