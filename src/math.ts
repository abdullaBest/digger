/**
 * @param {number} a initial value
 * @param {number} b target value
 * @param {number} t factor
 * @returns {number} .
 */
export function lerp(a: number, b: number, t: number): number {
	return a + t * (b - a);
}

export function map(x: number, a: number, b: number, toa: number, tob: number) : number {
    return (x - a) / (b - a) * (tob - toa) + toa;
}

export function clamp(x: number, min: number, max: number) : number {
    return Math.max(min, Math.min(max, x));
}

export function distlerp(a: number, b: number, min: number, max: number) : number { 
    const m = map(Math.abs(a - b), min, max, 0, 1);
    const c = clamp(m, 0, 1);
    return lerp(a, b, c);
}

