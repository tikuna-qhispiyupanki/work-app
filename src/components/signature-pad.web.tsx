import { Ref, useImperativeHandle, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { Colors } from '@/constants/theme';

export type SignaturePadHandle = { toJpeg: () => Promise<{ blob: Blob; width: number; height: number } | null>; hasInk: () => boolean };

const W = 600; // taille de l'image enregistrée (pixels)
const H = 240;

// Zone de signature au doigt (ou à la souris sur ordinateur).
export function SignaturePad({ ref, onInk }: { ref?: Ref<SignaturePadHandle>; onInk?: (has: boolean) => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);
  const [ink, setInk] = useState(false);

  const ctx = () => {
    const c = canvas.current?.getContext('2d');
    if (c) {
      c.lineWidth = 3.2;
      c.lineCap = 'round';
      c.lineJoin = 'round';
      c.strokeStyle = '#10213A';
    }
    return c;
  };
  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
  };
  const start = (e: React.PointerEvent<HTMLCanvasElement>) => {
    drawing.current = true;
    last.current = pos(e);
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const c = ctx();
    const p = pos(e);
    if (!c) return;
    c.beginPath();
    c.moveTo(last.current.x, last.current.y);
    c.lineTo(p.x, p.y);
    c.stroke();
    last.current = p;
    if (!ink) {
      setInk(true);
      onInk?.(true);
    }
  };
  const end = () => {
    drawing.current = false;
    last.current = null;
  };
  const clear = () => {
    const c = ctx();
    c?.clearRect(0, 0, W, H);
    setInk(false);
    onInk?.(false);
  };

  useImperativeHandle(ref, () => ({
    hasInk: () => ink,
    // JPEG sur fond blanc (le stockage n'accepte que le JPEG).
    toJpeg: async () => {
      if (!canvas.current || !ink) return null;
      const out = document.createElement('canvas');
      out.width = W;
      out.height = H;
      const o = out.getContext('2d');
      if (!o) return null;
      o.fillStyle = '#FFFFFF';
      o.fillRect(0, 0, W, H);
      o.drawImage(canvas.current, 0, 0);
      const blob = await new Promise<Blob | null>((r) => out.toBlob(r, 'image/jpeg', 0.9));
      return blob ? { blob, width: W, height: H } : null;
    },
  }));

  return (
    <View style={{ gap: 6 }}>
      <canvas
        ref={canvas}
        width={W}
        height={H}
        aria-label="Zone de signature"
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        style={{ width: '100%', aspectRatio: `${W} / ${H}`, background: '#FFFFFF', border: `2px dashed ${Colors.border}`, borderRadius: 10, touchAction: 'none' }}
      />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ fontSize: 13, color: Colors.textSecondary }}>Signer avec le doigt dans le cadre</Text>
        <Pressable onPress={clear} accessibilityRole="button">
          <Text style={{ fontSize: 15, color: Colors.primary, fontWeight: '600' }}>Effacer</Text>
        </Pressable>
      </View>
    </View>
  );
}
