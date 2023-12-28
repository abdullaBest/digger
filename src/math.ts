/**
 * @param {number} a initial value
 * @param {number} b target value
 * @param {number} t factor
 * @returns {number} .
 */
export function lerp(a: number, b: number, t: number): number {
	return a + t * (b - a);
}
