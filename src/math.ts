/**
 * @param {number} a initial value
 * @param {number} b target value
 * @param {number} t factor
 * @returns {number} .
 */
export function lerp(a: number, b: number, t: number): number {
	return a + t * (b - a);
}

export function distlerp(a: number, b: number, t: number) : number { 
    const tt = Math.min(1.0, 1.0 / (Math.abs(b - a) + 0.01));
    return a + (b - a) * t * tt; 
}

