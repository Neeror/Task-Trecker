import { useMemo } from 'react';
import type { FC } from 'react';
import { StyleSheet, View } from 'react-native';
import { MAP_STYLE_URL } from '@/config/map';
import { boundsOf, buildSegments } from '@/logic/runMetrics';
import { RouteSvg } from '@/components/RouteSvg';
import { colors, radius } from '@/theme/colors';
import type { RunPoint } from '@/types';

type Props = {
  points: readonly RunPoint[];
  height: number;
  emptyHint: string;
  /** Live-режим: камера їде за треком, а не застигає на першому кадрі. */
  follow?: boolean;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
type MapLibre = {
  MapView: FC<any>;
  Camera: FC<any>;
  ShapeSource: FC<any>;
  LineLayer: FC<any>;
  CircleLayer: FC<any>;
};
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Ліниве завантаження нативного модуля. В Expo Go нативної частини немає —
 * і замість краху ми маємо SVG-маршрут. Це і є та сама «карта без вайфаю»:
 * тайли беруться з офлайн-пака, а трек малюється з локальної БД.
 */
function loadMapLibre(): MapLibre | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('@maplibre/maplibre-react-native') as Partial<MapLibre>;
    if (
      mod.MapView === undefined ||
      mod.Camera === undefined ||
      mod.ShapeSource === undefined ||
      mod.LineLayer === undefined ||
      mod.CircleLayer === undefined
    ) {
      return null;
    }
    return mod as MapLibre;
  } catch {
    return null;
  }
}

const maplibre = loadMapLibre();

export function RunMap({ points, height, emptyHint, follow = false }: Props) {
  const geo = useMemo(() => {
    const segments = buildSegments(points).filter((s) => s.length > 1);
    const bounds = boundsOf(points);
    const firstSegment = segments[0];
    const lastSegment = segments[segments.length - 1];
    const start = firstSegment?.[0] ?? null;
    const finish = lastSegment?.[lastSegment.length - 1] ?? null;

    return {
      bounds,
      route: {
        type: 'FeatureCollection' as const,
        features: segments.map((segment) => ({
          type: 'Feature' as const,
          properties: {},
          geometry: {
            type: 'LineString' as const,
            coordinates: segment.map((p) => [p.lon, p.lat]),
          },
        })),
      },
      markers: {
        type: 'FeatureCollection' as const,
        features: [
          ...(start === null
            ? []
            : [
                {
                  type: 'Feature' as const,
                  properties: { role: 'start' },
                  geometry: {
                    type: 'Point' as const,
                    coordinates: [start.lon, start.lat],
                  },
                },
              ]),
          ...(finish === null
            ? []
            : [
                {
                  type: 'Feature' as const,
                  properties: { role: 'finish' },
                  geometry: {
                    type: 'Point' as const,
                    coordinates: [finish.lon, finish.lat],
                  },
                },
              ]),
        ],
      },
    };
  }, [points]);

  const { bounds } = geo;

  // Немає нативної карти або ще немає що малювати — деградуємо до SVG.
  if (maplibre === null || bounds === null || geo.route.features.length === 0) {
    return <RouteSvg points={points} height={height} emptyHint={emptyHint} />;
  }

  const { MapView, Camera, ShapeSource, LineLayer, CircleLayer } = maplibre;

  const cameraBounds = {
    ne: [bounds.maxLon, bounds.maxLat],
    sw: [bounds.minLon, bounds.minLat],
    paddingTop: 32,
    paddingBottom: 32,
    paddingLeft: 32,
    paddingRight: 32,
  };

  return (
    <View style={[styles.wrapper, { height }]}>
      <MapView
        style={StyleSheet.absoluteFill}
        mapStyle={MAP_STYLE_URL}
        logoEnabled={false}
        attributionEnabled
        compassEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
      >
        {follow ? (
          // Трек росте на очах: тримаємо його в кадрі.
          <Camera bounds={cameraBounds} animationDuration={600} />
        ) : (
          <Camera defaultSettings={{ bounds: cameraBounds }} animationDuration={0} />
        )}
        <ShapeSource id="run-route" shape={geo.route}>
          <LineLayer
            id="run-route-line"
            style={{
              lineColor: colors.primary,
              lineWidth: 5,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </ShapeSource>
        <ShapeSource id="run-markers" shape={geo.markers}>
          <CircleLayer
            id="run-markers-circle"
            style={{
              circleRadius: 6,
              circleStrokeWidth: 3,
              circleStrokeColor: colors.background,
              circleColor: [
                'match',
                ['get', 'role'],
                'start',
                colors.success,
                colors.danger,
              ],
            }}
          />
        </ShapeSource>
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    backgroundColor: colors.surface,
  },
});
