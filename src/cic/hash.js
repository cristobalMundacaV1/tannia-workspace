import crypto from 'node:crypto';
export const canon = (v) => JSON.stringify(v, (k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.keys(x).sort().map((kk) => [kk, x[kk]])) : x));
export const sha256 = (v) => crypto.createHash('sha256').update(typeof v === 'string' || Buffer.isBuffer(v) ? v : canon(v)).digest('hex');
