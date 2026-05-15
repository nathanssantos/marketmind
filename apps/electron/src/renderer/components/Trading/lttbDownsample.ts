/**
 * Largest-Triangle-Three-Buckets (LTTB) downsampling.
 *
 * Sveinn Steinarsson's algorithm (2013) for time-series visualization
 * downsampling. Standard tool in financial charting libraries — it
 * preserves shape and visual peaks far better than uniform decimation
 * or bucket-averaging, both of which wash out the spikes that matter
 * most to a trader reading a score chart.
 *
 * Inputs: an x-sorted array (`getX` extracts the x coordinate, `getY`
 * extracts the y coordinate that drives the visual envelope) and a
 * `threshold` = target output point count.
 *
 * Outputs: a new array containing AT MOST `threshold` points selected
 * from the input. First and last input points are always preserved
 * (so the chart's edges stay anchored to real samples).
 *
 * Algorithm (3 buckets of width `n / (threshold - 2)`):
 *   - bucket 0 holds the first point (kept verbatim)
 *   - the last bucket holds the last point (kept verbatim)
 *   - for each middle bucket, pick the point that forms the largest
 *     triangle with the previously-selected point and the AVERAGE of
 *     the next bucket. The "largest triangle" criterion is what keeps
 *     visual peaks — the only way to maximize triangle area is to pick
 *     the extreme that defines the envelope.
 *
 * Complexity: O(n). No allocations beyond the output array.
 */
export const lttbDownsample = <T>(
  data: T[],
  threshold: number,
  getX: (p: T) => number,
  getY: (p: T) => number,
): T[] => {
  if (threshold >= data.length || threshold < 3) return data;

  const sampled: T[] = [];
  const bucketSize = (data.length - 2) / (threshold - 2);
  let a = 0;
  sampled.push(data[0]!);

  for (let i = 0; i < threshold - 2; i += 1) {
    // Bucket [start, end) of the data range that this output point
    // will be selected from. Bucket 0 = `[1, bucketSize+1)`; data[0]
    // is reserved as the first preserved point. The final input point
    // is appended after the loop, so the last middle bucket ends
    // before data.length - 1.
    const rangeStart = Math.floor(i * bucketSize) + 1;
    const rangeEnd = Math.floor((i + 1) * bucketSize) + 1;

    // Average of the NEXT bucket — this is the third vertex of the
    // triangles we're going to maximize over the current bucket. Using
    // the next bucket's mean (instead of the actual next selected
    // point, which is what we're trying to determine) is the LTTB
    // trick that makes the algorithm O(n) instead of O(n²).
    const avgRangeStart = Math.floor((i + 1) * bucketSize) + 1;
    const avgRangeEnd = Math.min(Math.floor((i + 2) * bucketSize) + 1, data.length);
    let avgX = 0;
    let avgY = 0;
    let avgCount = 0;
    for (let j = avgRangeStart; j < avgRangeEnd; j += 1) {
      avgX += getX(data[j]!);
      avgY += getY(data[j]!);
      avgCount += 1;
    }
    if (avgCount > 0) {
      avgX /= avgCount;
      avgY /= avgCount;
    }

    const pointAX = getX(data[a]!);
    const pointAY = getY(data[a]!);

    // Scan the current bucket; pick the point that maximizes the
    // triangle area formed with `pointA` (last selected) and the
    // next-bucket average.
    let maxArea = -1;
    let maxAreaIdx = rangeStart;
    for (let j = rangeStart; j < rangeEnd; j += 1) {
      const pointX = getX(data[j]!);
      const pointY = getY(data[j]!);
      const area = Math.abs(
        (pointAX - avgX) * (pointY - pointAY) - (pointAX - pointX) * (avgY - pointAY),
      ) * 0.5;
      if (area > maxArea) {
        maxArea = area;
        maxAreaIdx = j;
      }
    }
    sampled.push(data[maxAreaIdx]!);
    a = maxAreaIdx;
  }

  sampled.push(data[data.length - 1]!);
  return sampled;
};
