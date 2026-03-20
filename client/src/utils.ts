/** hex 문자열 "#FFB7B2" → Three.js 숫자 0xFFB7B2 */
export const toThreeColor = (hex: string): number =>
  parseInt(hex.replace('#', ''), 16);
