import { Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';
import type { PlanImage } from '@/db/visits';
import { fromWorldPx, GeoPoint, MapLayer, MAX_ZOOM, TILE, tileUrl, tilesForView, toWorldPx } from '@/domain/geo';

// Repère affiché sur la carte : le chantier (épingle rouge) ou un arbre (rond vert numéroté).
export type MapMarker = { id: string; lat: number; lng: number; kind: 'site' | 'tree'; label?: string; title?: string; selected?: boolean };

export type GeoMapHandle = { capture: () => Promise<PlanImage | null> };

type Props = {
  center: GeoPoint; // centre de départ ; la carte se recentre quand il change
  markers: MapMarker[];
  onTap?: (p: GeoPoint) => void; // toucher (sans glisser) sur la carte
  onViewChange?: () => void; // fond, zoom ou déplacement de la vue
  hint?: string;
  ref?: Ref<GeoMapHandle>;
};

const HEIGHT = 280;
const CAPTURE_W = 1200; // taille de l'image enregistrée (pixels)
const CAPTURE_H = 800;
const TAP_TOLERANCE = 8; // au-delà, c'est un glissement (déplacement de la carte)

export function GeoMap({ center, markers, onTap, onViewChange, hint, ref }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; cx: number; cy: number; moved: boolean } | null>(null);
  const [width, setWidth] = useState(0);
  const [layer, setLayer] = useState<MapLayer>('aerien');
  const [zoom, setZoom] = useState(18);
  const [view, setView] = useState<GeoPoint>(center);
  const [failed, setFailed] = useState(0);
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);

  useEffect(() => setView(center), [center.lat, center.lng]); // eslint-disable-line react-hooks/exhaustive-deps

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

  useEffect(() => setFailed(0), [layer, zoom, view.lat, view.lng]);

  useImperativeHandle(ref, () => ({
    capture: () => (online && failed === 0 ? renderPlan(view, layer, zoom, markers) : Promise.resolve(null)),
  }));

  const grid = width ? tilesForView(view, zoom, width, HEIGHT) : null;
  const toScreen = (p: GeoPoint) => {
    const w = toWorldPx(p, zoom);
    return grid ? { x: w.x - grid.originX, y: w.y - grid.originY } : { x: -100, y: -100 };
  };

  const changeLayer = (l: MapLayer) => {
    setLayer(l);
    setZoom((z) => Math.min(z, MAX_ZOOM[l]));
    onViewChange?.();
  };
  const changeZoom = (delta: number) => {
    setZoom((z) => Math.max(13, Math.min(MAX_ZOOM[layer], z + delta)));
    onViewChange?.();
  };

  // Glisser = déplacer la carte ; toucher sans bouger = onTap.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    const c = toWorldPx(view, zoom);
    drag.current = { x: e.clientX, y: e.clientY, cx: c.x, cy: c.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (!d.moved && Math.hypot(dx, dy) < TAP_TOLERANCE) return;
    d.moved = true;
    setView(fromWorldPx(d.cx - dx, d.cy - dy, zoom));
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = drag.current;
    drag.current = null;
    if (!d || !grid || !box.current) return;
    if (d.moved) {
      onViewChange?.();
      return;
    }
    const r = box.current.getBoundingClientRect();
    onTap?.(fromWorldPx(grid.originX + e.clientX - r.left, grid.originY + e.clientY - r.top, zoom));
  };

  return (
    <View style={{ gap: Spacing.sm }}>
      <div
        ref={box}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => (drag.current = null)}
        role="img"
        aria-label="Carte du chantier"
        style={{
          position: 'relative',
          height: HEIGHT,
          overflow: 'hidden',
          borderRadius: 8,
          background: '#DDE3D8',
          cursor: onTap ? 'crosshair' : 'grab',
          touchAction: 'none',
          userSelect: 'none',
        }}
      >
        {online && grid
          ? grid.tiles.map((t) => (
              <img
                key={`${layer}-${zoom}-${t.x}-${t.y}`}
                src={tileUrl(layer, zoom, t.x, t.y)}
                alt=""
                draggable={false}
                onError={() => setFailed((n) => n + 1)}
                style={{ position: 'absolute', left: t.left, top: t.top, width: TILE, height: TILE, pointerEvents: 'none' }}
              />
            ))
          : null}
        {!online ? (
          <div style={{ padding: 16, color: Colors.textSecondary, fontSize: 15 }}>
            Carte indisponible hors-ligne. Les positions sont gardées ; la carte reviendra avec le réseau.
          </div>
        ) : null}
        {markers.map((m) => {
          const s = toScreen(m);
          return m.kind === 'site' ? <SitePin key={m.id} x={s.x} y={s.y} /> : <TreeDot key={m.id} x={s.x} y={s.y} marker={m} />;
        })}
        <span style={{ position: 'absolute', right: 4, bottom: 2, fontSize: 10, color: '#fff', textShadow: '0 0 2px #000', pointerEvents: 'none' }}>
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
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

function SitePin({ x, y }: { x: number; y: number }) {
  return (
    <div style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -100%)', pointerEvents: 'none' }}>
      <svg width="30" height="40" viewBox="0 0 30 40" aria-hidden>
        <path d="M15 39C15 39 28 24 28 14A13 13 0 0 0 2 14C2 24 15 39 15 39Z" fill="#D7263D" stroke="#fff" strokeWidth="2" />
        <circle cx="15" cy="14" r="5" fill="#fff" />
      </svg>
    </div>
  );
}

function TreeDot({ x, y, marker }: { x: number; y: number; marker: MapMarker }) {
  return (
    <div
      aria-label={`Arbre ${marker.label}${marker.title ? ` – ${marker.title}` : ''}`}
      style={{ position: 'absolute', left: x, top: y, transform: 'translate(-50%, -50%)', pointerEvents: 'none', textAlign: 'center' }}
    >
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: 14,
          margin: '0 auto',
          background: marker.selected ? '#E0A23B' : '#1B7F4B',
          border: '2.5px solid #fff',
          boxShadow: '0 1px 3px rgba(0,0,0,.5)',
          color: '#fff',
          fontWeight: 700,
          fontSize: 14,
          lineHeight: '23px',
        }}
      >
        {marker.label}
      </div>
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

// Dessine la vue dans une image JPEG (zoom +1 et taille ×2 pour une image nette, même cadrage),
// avec le repère du chantier, les arbres numérotés et une légende.
async function renderPlan(view: GeoPoint, layer: MapLayer, zoom: number, markers: MapMarker[]): Promise<PlanImage | null> {
  const z = Math.min(zoom + 1, MAX_ZOOM[layer]);
  const scale = 2 ** (zoom + 1 - z); // 1 si le zoom +1 existe, sinon 2 (agrandissement)
  const w = CAPTURE_W / scale;
  const h = CAPTURE_H / scale;
  const { tiles, originX, originY } = tilesForView(view, z, w, h);
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

  const pos = (m: GeoPoint) => {
    const p = toWorldPx(m, z);
    return { x: (p.x - originX) * scale, y: (p.y - originY) * scale };
  };

  for (const m of markers.filter((m) => m.kind === 'site')) drawSitePin(ctx, pos(m));
  const trees = markers.filter((m) => m.kind === 'tree');
  for (const m of trees) drawTree(ctx, pos(m), m.label ?? '');

  // Légende des arbres (en haut à gauche).
  if (trees.length) {
    ctx.font = '600 24px sans-serif';
    const lines = trees.map((t) => `${t.label}. ${t.title || 'Arbre'}`);
    const lw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 32;
    ctx.fillStyle = 'rgba(255,255,255,0.88)';
    ctx.fillRect(12, 12, lw, lines.length * 34 + 16);
    ctx.fillStyle = '#1C1C1A';
    lines.forEach((l, i) => ctx.fillText(l, 28, 46 + i * 34));
  }

  // Mentions : source IGN et coordonnées du chantier.
  const site = markers.find((m) => m.kind === 'site') ?? view;
  const text = `© IGN – ${site.lat.toFixed(5)}, ${site.lng.toFixed(5)}`;
  ctx.font = '22px sans-serif';
  const tw = ctx.measureText(text).width;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(CAPTURE_W - tw - 24, CAPTURE_H - 36, tw + 24, 36);
  ctx.fillStyle = '#fff';
  ctx.fillText(text, CAPTURE_W - tw - 12, CAPTURE_H - 11);

  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.8));
  return blob ? { blob, width: CAPTURE_W, height: CAPTURE_H } : null;
}

function drawSitePin(ctx: CanvasRenderingContext2D, { x, y }: { x: number; y: number }) {
  ctx.fillStyle = '#D7263D';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.bezierCurveTo(x - 10, y - 22, x - 26, y - 34, x - 26, y - 52);
  ctx.arc(x, y - 52, 26, Math.PI, 0);
  ctx.bezierCurveTo(x + 26, y - 34, x + 10, y - 22, x, y);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(x, y - 52, 10, 0, 2 * Math.PI);
  ctx.fill();
}

function drawTree(ctx: CanvasRenderingContext2D, { x, y }: { x: number; y: number }, label: string) {
  ctx.fillStyle = '#1B7F4B';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(x, y, 24, 0, 2 * Math.PI);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 26px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, x, y + 1);
  ctx.textAlign = 'start';
  ctx.textBaseline = 'alphabetic';
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
