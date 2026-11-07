import { Ref, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Colors, Spacing } from '@/constants/theme';

export type SketchHandle = { toJpeg: () => Promise<{ blob: Blob; width: number; height: number } | null>; strokes: () => number };
type Point = { x: number; y: number };
type Stroke = { color: string; width: number; points: Point[] };

const COLORS = [
  { name: 'Noir', value: '#111111' },
  { name: 'Rouge', value: '#D7263D' },
  { name: 'Bleu', value: '#1E5AA8' },
  { name: 'Vert', value: '#1B7F4B' },
  { name: 'Jaune', value: '#F2C200' },
];
const WIDTHS = [
  { name: 'Fin', value: 4 },
  { name: 'Moyen', value: 9 },
  { name: 'Épais', value: 18 },
];
const BLANK_W = 1600;
const BLANK_H = 1200;

// Croquis à main levée : sur une page blanche ou sur une image (plan, photo).
// L'image de fond et les traits sont dessinés dans un canvas à la taille réelle de l'image.
export function SketchEditor({ background, ref }: { background: Blob | null; ref?: Ref<SketchHandle> }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const bg = useRef<HTMLImageElement | null>(null);
  const strokes = useRef<Stroke[]>([]);
  const current = useRef<Stroke | null>(null);
  const [size, setSize] = useState({ w: BLANK_W, h: BLANK_H });
  const [color, setColor] = useState(COLORS[1].value);
  const [width, setWidth] = useState(WIDTHS[1].value);
  const [count, setCount] = useState(0);

  const redraw = () => {
    const c = canvas.current?.getContext('2d');
    if (!c) return;
    c.fillStyle = '#FFFFFF';
    c.fillRect(0, 0, size.w, size.h);
    if (bg.current) c.drawImage(bg.current, 0, 0, size.w, size.h);
    else {
      // Page blanche : léger quadrillage pour aider à dessiner droit.
      c.strokeStyle = '#E9ECEF';
      c.lineWidth = 2;
      for (let x = 100; x < size.w; x += 100) c.beginPath(), c.moveTo(x, 0), c.lineTo(x, size.h), c.stroke();
      for (let y = 100; y < size.h; y += 100) c.beginPath(), c.moveTo(0, y), c.lineTo(size.w, y), c.stroke();
    }
    for (const s of [...strokes.current, ...(current.current ? [current.current] : [])]) {
      c.strokeStyle = s.color;
      c.lineWidth = s.width;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.beginPath();
      s.points.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
      if (s.points.length === 1) c.lineTo(s.points[0].x + 0.1, s.points[0].y);
      c.stroke();
    }
  };

  useEffect(() => {
    if (!background) {
      bg.current = null;
      setSize({ w: BLANK_W, h: BLANK_H });
      return;
    }
    const url = URL.createObjectURL(background);
    const img = new Image();
    img.onload = () => {
      bg.current = img;
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      setSize({ w: Math.round(img.naturalWidth * scale), h: Math.round(img.naturalHeight * scale) });
    };
    img.src = url;
    return () => URL.revokeObjectURL(url);
  }, [background]);
  useEffect(redraw, [size]); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * size.w, y: ((e.clientY - r.top) / r.height) * size.h };
  };
  // L'épaisseur est choisie à l'écran : on la ramène à la taille réelle de l'image.
  const scaleWidth = (e: React.PointerEvent<HTMLCanvasElement>) => width * (size.w / e.currentTarget.getBoundingClientRect().width) * 0.5;

  useImperativeHandle(ref, () => ({
    strokes: () => strokes.current.length,
    toJpeg: async () => {
      redraw();
      if (!canvas.current) return null;
      const blob = await new Promise<Blob | null>((r) => canvas.current!.toBlob(r, 'image/jpeg', 0.85));
      return blob ? { blob, width: size.w, height: size.h } : null;
    },
  }));

  return (
    <View style={{ gap: Spacing.sm }}>
      <canvas
        ref={canvas}
        width={size.w}
        height={size.h}
        aria-label="Zone de dessin du croquis"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          current.current = { color, width: scaleWidth(e), points: [pos(e)] };
          redraw();
        }}
        onPointerMove={(e) => {
          if (!current.current) return;
          current.current.points.push(pos(e));
          redraw();
        }}
        onPointerUp={() => {
          if (current.current) strokes.current.push(current.current);
          current.current = null;
          setCount(strokes.current.length);
          redraw();
        }}
        onPointerCancel={() => {
          current.current = null;
          redraw();
        }}
        style={{ width: '100%', aspectRatio: `${size.w} / ${size.h}`, borderRadius: 8, border: `1px solid ${Colors.border}`, touchAction: 'none', background: '#fff' }}
      />
      <View style={styles.row}>
        {COLORS.map((c) => (
          <Pressable
            key={c.value}
            onPress={() => setColor(c.value)}
            accessibilityRole="radio"
            accessibilityLabel={`Couleur ${c.name}`}
            aria-checked={color === c.value}
            style={[styles.color, { backgroundColor: c.value }, color === c.value && styles.colorOn]}
          />
        ))}
      </View>
      <View style={styles.row}>
        {WIDTHS.map((w) => (
          <Pressable key={w.value} onPress={() => setWidth(w.value)} accessibilityRole="radio" aria-checked={width === w.value} style={[styles.tool, width === w.value && styles.toolOn]}>
            <Text style={[styles.toolText, width === w.value && { color: Colors.primaryText }]}>{w.name}</Text>
          </Pressable>
        ))}
        <View style={{ flex: 1 }} />
        <Pressable
          onPress={() => {
            strokes.current.pop();
            setCount(strokes.current.length);
            redraw();
          }}
          disabled={!count}
          accessibilityRole="button"
          style={[styles.tool, !count && { opacity: 0.4 }]}
        >
          <Text style={styles.toolText}>↶ Annuler</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            strokes.current = [];
            setCount(0);
            redraw();
          }}
          disabled={!count}
          accessibilityRole="button"
          style={[styles.tool, !count && { opacity: 0.4 }]}
        >
          <Text style={styles.toolText}>Tout effacer</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center', flexWrap: 'wrap' },
  color: { width: 38, height: 38, borderRadius: 19, borderWidth: 2, borderColor: '#fff' },
  colorOn: { borderColor: Colors.text, transform: [{ scale: 1.15 }] },
  tool: { borderWidth: 1, borderColor: Colors.primary, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: Colors.card },
  toolOn: { backgroundColor: Colors.primary },
  toolText: { fontSize: 15, color: Colors.primary, fontWeight: '600' },
});
