import { Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import { fromWorldPx, GeoPoint, MapLayer, MAX_ZOOM, TILE, tileUrl, tilesForView } from '@/domain/geo';
import type { PlanImage } from '@/db/visits';

export type MapPickerHandle = { capture: () => Promise<PlanImage | null> };

type Props = {
  point: GeoPoint;
  onMove: (p: GeoPoint) => void;
  onViewChange?: () => void; // changement de fond (plan / aérien) ou de zoom
  ref?: Ref<MapPickerHandle>;
};

const HEIGHT = 260;
const CAPTURE_W = 1200; // taille de l'image enregistrée (pixels)
const CAPTURE_H = 800;

// Carte IGN (plan ou vue aérienne) centrée sur le repère. Toucher la carte déplace le repère.
export function MapPicker({ point, onMove, onViewChange, ref }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [layer, setLayer] = useState<MapLayer>('aerien');
  const [zoom, setZoom] = useState(18);
  const [failed, setFailed] = useState(0);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    const on = () => setOnline(navigator.onLine);
    window.addEventListener('online', on);
    window.addEventListener('offline', on);
    return () => {
      ro.disconnect();
      window.removeEventListener('online', on);
      window.removeEventListener('offline', on);
    };
  }, []);

  useEffect(() => setFailed(0), [layer, zoom, point.lat, point.lng]);
  const changeLayer = (l: MapLayer) => {
    setLayer(l);
    setZoom((z) => Math.min(z, MAX_ZOOM[l]));
    onViewChange?.();
  };
  const changeZoom = (delta: number) => {
    setZoom((z) => Math.max(13, Math.min(MAX_ZOOM[layer], z + delta)));
    onViewChange?.();
  };

  useImperativeHandle(ref, () => ({
    capture: () => (online && failed === 0 ? renderPlan(point, layer, zoom) : Promise.resolve(null)),
  }));

  const view = width ? tilesForView(point, zoom, width, HEIGHT) : null;

  const onTap = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!view || !box.current) return;
    const r = box.current.getBoundingClientRect();
    onMove(fromWorldPx(view.originX + e.clientX - r.left, view.originY + e.clientY - r.top, zoom));
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <div
        ref={box}
        onClick={onTap}
        role="img"
        aria-label="Carte du chantier"
        style={{ position: 'relative', height: HEIGHT, overflow: 'hidden', borderRadius: 8, background: '#DDE3D8', cursor: 'crosshair' }}
      >
        {online && view
          ? view.tiles.map((t) => (
              <img
                key={`${layer}-${zoom}-${t.x}-${t.y}`}
                src={tileUrl(layer, zoom, t.x, t.y)}
                alt=""
                draggable={false}
                onError={() => setFailed((n) => n + 1)}
                style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE, userSelect: 'none' }}
              />
            ))
          : null}
        {!online ? (
          <div style={{ padding: 16, color: Colors.textSecondary, fontSize: 15 }}>
            Carte indisponible hors-ligne. La position est bien enregistrée : l&apos;image du plan pourra être faite au
            retour du réseau, avec « Modifier ».
          </div>
        ) : null}
        <Pin />
        <span style={{ position: 'absolute', right: 4, bottom: 2, fontSize: 10, color: '#fff', textShadow: '0 0 2px #000' }}>
          © IGN
        </span>
      </div>
      <View style={styles.toolbar}>
        <Toggle label="Vue aérienne" active={layer === 'aerien'} onPress={() => changeLayer('aerien')} />
        <Toggle label="Plan" active={layer === 'plan'} onPress={() => changeLayer('plan')} />
        <View style={{ flex: 1 }} />
        <Toggle label="−" active={false} onPress={() => changeZoom(-1)} />
        <Toggle label="+" active={false} onPress={() => changeZoom(1)} />
      </View>
      <Text style={styles.hint}>Touche la carte pour placer le repère exactement sur le chantier.</Text>
    </View>
  );
}

function Pin() {
  return (
    <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -100%)', pointerEvents: 'none' }}>
      <svg width="30" height="40" viewBox="0 0 30 40" aria-hidden>
        <path d="M15 39C15 39 28 24 28 14A13 13 0 0 0 2 14C2 24 15 39 15 39Z" fill="#D7263D" stroke="#fff" strokeWidth="2" />
        <circle cx="15" cy="14" r="5" fill="#fff" />
      </svg>
    </div>
  );
}

function Toggle({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.toggle, active && styles.toggleActive]} accessibilityRole="button">
      <Text style={[styles.toggleText, active && { color: Colors.primaryText }]}>{label}</Text>
    </Pressable>
  );
}

// Dessine la vue dans une image JPEG (zoom +1 et taille ×2 pour une image nette, même cadrage).
async function renderPlan(point: GeoPoint, layer: MapLayer, zoom: number): Promise<PlanImage | null> {
  const z = Math.min(zoom + 1, MAX_ZOOM[layer]);
  const scale = 2 ** (zoom + 1 - z); // 1 si le zoom +1 existe, sinon 2 (agrandissement)
  const w = CAPTURE_W / scale;
  const h = CAPTURE_H / scale;
  const { tiles } = tilesForView(point, z, w, h);
  const canvas = document.createElement('canvas');
  canvas.width = CAPTURE_W;
  canvas.height = CAPTURE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = '#DDE3D8';
  ctx.fillRect(0, 0, CAPTURE_W, CAPTURE_H);

  const images = await Promise.all(tiles.map((t) => loadImage(tileUrl(layer, z, t.x, t.y))));
  if (images.some((img) => !img)) return null;
  images.forEach((img, i) => ctx.drawImage(img!, tiles[i].left * scale, tiles[i].top * scale, TILE * scale, TILE * scale));

  // Repère rouge au centre.
  const cx = CAPTURE_W / 2;
  const cy = CAPTURE_H / 2;
  ctx.fillStyle = '#D7263D';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.bezierCurveTo(cx - 10, cy - 22, cx - 26, cy - 34, cx - 26, cy - 52);
  ctx.arc(cx, cy - 52, 26, Math.PI, 0);
  ctx.bezierCurveTo(cx + 26, cy - 34, cx + 10, cy - 22, cx, cy);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(cx, cy - 52, 10, 0, 2 * Math.PI);
  ctx.fill();

  // Mentions : source IGN et coordonnées.
  const text = `© IGN – ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}`;
  ctx.font = '22px sans-serif';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(CAPTURE_W - tw - 24, CAPTURE_H - 36, tw + 24, 36);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, CAPTURE_W - tw - 12, CAPTURE_H - 11);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
  return blob ? { blob, width: CAPTURE_W, height: CAPTURE_H } : null;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

const styles = StyleSheet.create({
  toolbar: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
  toggle: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: Colors.card,
    minWidth: 40,
    alignItems: 'center',
  },
  toggleActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  toggleText: { fontSize: 15, color: Colors.text, fontWeight: '500' },
  hint: { fontSize: 13, color: Colors.textSecondary },
});
