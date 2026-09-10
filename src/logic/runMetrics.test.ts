import {
  DEFAULT_RUN_FILTERS,
  EMPTY_ACCUMULATOR,
  boundsOf,
  buildSegments,
  computeSplits,
  elapsedMs,
  ingestSample,
  ingestSamples,
  isRunGoalMet,
  projectSegments,
  type GeoSample,
} from '@/logic/runMetrics';
import { haversineM } from '@/logic/geo';
import type { Run, RunPoint } from '@/types';

const T0 = 1_700_000_000_000;

function sample(over: Partial<GeoSample> = {}): GeoSample {
  return {
    lat: 50.45,
    lon: 30.523,
    altitude: 180,
    accuracy: 6,
    speed: 3,
    recordedAt: T0,
    ...over,
  };
}

/** ~111 320 м на градус широти, тому 0.00009° ≈ 10 м. */
function latOffset(meters: number): number {
  return meters / 111_320;
}

function run(over: Partial<Run> = {}): Run {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    taskId: null,
    date: '2026-09-10',
    status: 'active',
    startedAt: T0,
    endedAt: null,
    pausedAt: null,
    pausedMs: 0,
    movingMs: 0,
    distanceM: 0,
    ascentM: 0,
    targetDistanceM: null,
    ...over,
  };
}

function point(seq: number, meters: number, atMs: number): RunPoint {
  return {
    runId: '00000000-0000-4000-8000-000000000001',
    seq,
    lat: 50.45 + latOffset(meters),
    lon: 30.523,
    altitude: null,
    accuracy: 5,
    speed: null,
    recordedAt: T0 + atMs,
  };
}

describe('ingestSample', () => {
  it('приймає першу точку без нарахування дистанції', () => {
    const out = ingestSample(EMPTY_ACCUMULATOR, sample());
    expect(out.accepted).toBe(true);
    expect(out.segmentBreak).toBe(true);
    expect(out.acc.seq).toBe(0);
    expect(out.acc.distanceM).toBe(0);
  });

  it('відкидає точки з поганою точністю', () => {
    const out = ingestSample(EMPTY_ACCUMULATOR, sample({ accuracy: 80 }));
    expect(out.accepted).toBe(false);
    expect(out.reason).toBe('low-accuracy');
  });

  it('відкидає точки з невалідними координатами', () => {
    const out = ingestSample(EMPTY_ACCUMULATOR, sample({ lat: Number.NaN }));
    expect(out.reason).toBe('invalid-coords');
  });

  it('накопичує дистанцію і час руху на нормальному кроці', () => {
    const first = ingestSample(EMPTY_ACCUMULATOR, sample());
    const second = ingestSample(
      first.acc,
      sample({ lat: 50.45 + latOffset(10), recordedAt: T0 + 3000 }),
    );
    expect(second.accepted).toBe(true);
    expect(second.acc.distanceM).toBeCloseTo(10, 0);
    expect(second.acc.movingMs).toBe(3000);
    expect(second.acc.seq).toBe(1);
  });

  it('не рахує час руху, коли стоїш на місці (автопауза)', () => {
    const first = ingestSample(EMPTY_ACCUMULATOR, sample());
    // 4 м за 20 с ≈ 0.2 м/с — нижче порога руху.
    const second = ingestSample(
      first.acc,
      sample({ lat: 50.45 + latOffset(4), recordedAt: T0 + 20_000 }),
    );
    expect(second.accepted).toBe(true);
    expect(second.acc.distanceM).toBeCloseTo(4, 0);
    expect(second.acc.movingMs).toBe(0);
  });

  it('відкидає джитер на місці', () => {
    const first = ingestSample(EMPTY_ACCUMULATOR, sample());
    const second = ingestSample(
      first.acc,
      sample({ lat: 50.45 + latOffset(1), recordedAt: T0 + 2000 }),
    );
    expect(second.accepted).toBe(false);
    expect(second.reason).toBe('too-close');
    expect(second.acc.distanceM).toBe(0);
  });

  it('відкидає телепорт GPS', () => {
    const first = ingestSample(EMPTY_ACCUMULATOR, sample());
    const second = ingestSample(
      first.acc,
      sample({ lat: 50.45 + latOffset(500), recordedAt: T0 + 2000 }),
    );
    expect(second.accepted).toBe(false);
    expect(second.reason).toBe('implausible-speed');
  });

  it('відкидає точки з минулого', () => {
    const first = ingestSample(EMPTY_ACCUMULATOR, sample({ recordedAt: T0 + 5000 }));
    const second = ingestSample(first.acc, sample({ recordedAt: T0 }));
    expect(second.reason).toBe('out-of-order');
  });

  it('рве трек на втраті сигналу і не додає дистанцію через діру', () => {
    const first = ingestSample(EMPTY_ACCUMULATOR, sample());
    const second = ingestSample(
      first.acc,
      sample({
        lat: 50.45 + latOffset(400),
        recordedAt: T0 + DEFAULT_RUN_FILTERS.maxGapMs + 5000,
      }),
    );
    expect(second.accepted).toBe(true);
    expect(second.segmentBreak).toBe(true);
    expect(second.acc.distanceM).toBe(0);
    expect(second.acc.seq).toBe(1);
  });

  it('рахує лише набір висоти, а не спуск', () => {
    const a = ingestSample(EMPTY_ACCUMULATOR, sample({ altitude: 100 }));
    const b = ingestSample(
      a.acc,
      sample({ lat: 50.45 + latOffset(10), recordedAt: T0 + 3000, altitude: 105 }),
    );
    const c = ingestSample(
      b.acc,
      sample({ lat: 50.45 + latOffset(20), recordedAt: T0 + 6000, altitude: 95 }),
    );
    expect(c.acc.ascentM).toBeCloseTo(5, 1);
  });
});

describe('ingestSamples', () => {
  it('сортує батч за часом і повертає seq для збережених точок', () => {
    const batch = [
      sample({ lat: 50.45 + latOffset(20), recordedAt: T0 + 6000 }),
      sample({ recordedAt: T0 }),
      sample({ lat: 50.45 + latOffset(10), recordedAt: T0 + 3000 }),
    ];
    const { acc, accepted } = ingestSamples(EMPTY_ACCUMULATOR, batch);
    expect(accepted.map((a) => a.seq)).toEqual([0, 1, 2]);
    expect(acc.distanceM).toBeCloseTo(20, 0);
  });
});

describe('elapsedMs', () => {
  it('віднімає закриті паузи', () => {
    expect(elapsedMs(run({ pausedMs: 60_000 }), T0 + 600_000)).toBe(540_000);
  });

  it('віднімає відкриту паузу в реальному часі', () => {
    const r = run({ pausedAt: T0 + 300_000, status: 'paused' });
    expect(elapsedMs(r, T0 + 400_000)).toBe(300_000);
  });

  it('для завершеної пробіжки не залежить від now', () => {
    const r = run({ status: 'finished', endedAt: T0 + 1_000_000, pausedMs: 0 });
    expect(elapsedMs(r, T0 + 9_999_999)).toBe(1_000_000);
  });
});

describe('isRunGoalMet', () => {
  it('дає 1% допуску на похибку GPS', () => {
    expect(isRunGoalMet(run({ targetDistanceM: 10_000, distanceM: 9_910 }))).toBe(true);
    expect(isRunGoalMet(run({ targetDistanceM: 10_000, distanceM: 9_000 }))).toBe(false);
  });

  it('без цілі вважається виконаною', () => {
    expect(isRunGoalMet(run({ targetDistanceM: null }))).toBe(true);
  });
});

describe('computeSplits', () => {
  it('ріже трек по кілометрах з інтерполяцією часу', () => {
    // Рівний біг: 250 м кожні 60 с → 4:00/км.
    const points: RunPoint[] = [];
    for (let i = 0; i <= 10; i += 1) {
      points.push(point(i, i * 250, i * 60_000));
    }
    const splits = computeSplits(points);
    expect(splits).toHaveLength(2);
    const [first, second] = splits;
    expect(first?.distanceM).toBe(1000);
    expect(first?.durationMs).toBeCloseTo(240_000, -3);
    expect(second?.partial).toBe(true);
  });

  it('на порожньому треку не падає', () => {
    expect(computeSplits([])).toEqual([]);
  });
});

describe('buildSegments', () => {
  it('розділяє трек на дірі в сигналі', () => {
    const points = [
      point(0, 0, 0),
      point(1, 10, 3000),
      point(2, 20, 3000 + DEFAULT_RUN_FILTERS.maxGapMs + 1000),
    ];
    const segments = buildSegments(points);
    expect(segments.map((s) => s.length)).toEqual([2, 1]);
  });
});

describe('projectSegments', () => {
  it('вписує маршрут у бокс і не перевертає широту', () => {
    const points = [
      { lat: 50.45, lon: 30.52 },
      { lat: 50.46, lon: 30.53 },
    ];
    const bounds = boundsOf(points);
    expect(bounds).not.toBeNull();
    if (bounds === null) return;

    const [projected] = projectSegments([points], bounds, {
      width: 200,
      height: 200,
      padding: 10,
    });
    const [a, b] = projected ?? [];
    expect(a).toBeDefined();
    expect(b).toBeDefined();
    if (a === undefined || b === undefined) return;
    // Північніша точка має бути вище на екрані.
    expect(b.y).toBeLessThan(a.y);
    expect(a.x).toBeGreaterThanOrEqual(10);
    expect(b.x).toBeLessThanOrEqual(190);
  });
});

describe('haversineM', () => {
  it('збігається з відомою відстанню на градус широти', () => {
    expect(haversineM({ lat: 0, lon: 0 }, { lat: 1, lon: 0 })).toBeCloseTo(111_195, -2);
  });
});
