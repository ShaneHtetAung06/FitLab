'use client';

/**
 * Dependency-free bar chart for the trainer dashboard.
 *
 * Built from divs rather than SVG: the design is blocky (a light track with a
 * solid fill), which plain elements express directly and which scales with the
 * container without viewBox maths. Still not worth a charting dependency.
 *
 * @param {object[]} data      [{ date: 'YYYY-MM-DD', value: number }]
 * @param {string}   label     series name, used in the accessible description
 * @param {Function} [format]  formats a value for display
 */

const MAX_BARS = 12;

function shortDate(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function monthLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString('en-US', { month: 'short' });
}

/**
 * Collapses a long daily series into at most MAX_BARS columns by summing
 * consecutive days. A year of data becomes twelve readable bars instead of 365
 * slivers.
 */
function bucketize(data) {
  if (data.length <= MAX_BARS) {
    return data.map((point) => ({
      key: point.date,
      label: shortDate(point.date),
      value: Number(point.value) || 0,
      days: 1,
      from: point.date,
      to: point.date,
    }));
  }

  const size = Math.ceil(data.length / MAX_BARS);
  const buckets = [];

  for (let index = 0; index < data.length; index += size) {
    const slice = data.slice(index, index + size);
    buckets.push({
      key: slice[0].date,
      // Wide buckets are effectively months, so a month name reads better.
      label: size >= 25 ? monthLabel(slice[0].date) : shortDate(slice[0].date),
      value: slice.reduce((sum, point) => sum + (Number(point.value) || 0), 0),
      days: slice.length,
      from: slice[0].date,
      to: slice[slice.length - 1].date,
    });
  }

  return buckets;
}

export default function TrendChart({
  data = [],
  label = 'Value',
  format = (value) => String(value),
}) {
  if (data.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center text-sm text-ink-400">
        No data for this period yet.
      </div>
    );
  }

  const buckets = bucketize(data);
  const max = Math.max(...buckets.map((bucket) => bucket.value));
  const total = buckets.reduce((sum, bucket) => sum + bucket.value, 0);
  const showValues = buckets.length <= MAX_BARS;

  return (
    <div>
      <div
        className="flex items-stretch gap-1.5 sm:gap-2.5"
        role="img"
        aria-label={`${label} by period: ${format(
          total
        )} in total across ${data.length} days, peaking at ${format(max)}.`}
      >
        {buckets.map((bucket) => {
          const ratio = max > 0 ? bucket.value / max : 0;
          // Non-zero values keep a sliver of height so they stay visible.
          const height = bucket.value > 0 ? Math.max(ratio * 100, 3) : 0;

          return (
            <div key={bucket.key} className="flex min-w-0 flex-1 flex-col items-center">
              {showValues && (
                <span className="mb-1.5 truncate text-[10px] font-medium text-ink-500">
                  {format(bucket.value)}
                </span>
              )}

              <div
                className="relative h-[150px] w-full overflow-hidden rounded-[3px] bg-primary-100"
                title={`${
                  bucket.days === 1
                    ? shortDate(bucket.from)
                    : `${shortDate(bucket.from)} – ${shortDate(bucket.to)}`
                }: ${format(bucket.value)}`}
              >
                <div
                  className="absolute inset-x-0 bottom-0 rounded-[3px] bg-primary-600"
                  style={{ height: `${height}%` }}
                />
              </div>

              <span className="mt-2 truncate text-[10px] text-ink-400">
                {bucket.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* The chart is an image to assistive tech, so the numbers are also
          available as text. */}
      <table className="sr-only">
        <caption>{label} by period</caption>
        <thead>
          <tr>
            <th scope="col">Period</th>
            <th scope="col">{label}</th>
          </tr>
        </thead>
        <tbody>
          {buckets.map((bucket) => (
            <tr key={bucket.key}>
              <th scope="row">
                {bucket.days === 1
                  ? shortDate(bucket.from)
                  : `${shortDate(bucket.from)} to ${shortDate(bucket.to)}`}
              </th>
              <td>{format(bucket.value)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
