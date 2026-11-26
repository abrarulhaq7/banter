/** Longest side of a screenshot after resizing, in pixels (PLAN.md section 5). */
export const MAX_IMAGE_SIDE = 1280;

/**
 * The size to resize a screenshot to before sending and uploading: the longest side
 * becomes at most 1280 px and the shape is kept. A smaller image is left alone.
 */
export function fitWithin(
  width: number,
  height: number,
  maxSide: number = MAX_IMAGE_SIDE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxSide || longest <= 0) return { width, height };
  const scale = maxSide / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
