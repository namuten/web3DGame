export const toThreeColor = (hex: string): number =>
  parseInt(hex.replace('#', ''), 16);

export const toHexString = (color: number): string =>
  '#' + color.toString(16).padStart(6, '0').toUpperCase();
