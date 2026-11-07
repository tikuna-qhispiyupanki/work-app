import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { Field } from '@/components/ui';
import { Colors } from '@/constants/theme';

// Champ numérique (virgule ou point acceptés), enregistré quand on quitte le champ.
export function NumberField({
  label,
  value,
  onCommit,
  unit,
  placeholder,
  allowEmpty = true,
}: {
  label: string;
  value: number | null;
  onCommit: (v: number | null) => void;
  unit?: string;
  placeholder?: string;
  allowEmpty?: boolean;
}) {
  const show = (v: number | null) => (v == null ? '' : String(v).replace('.', ','));
  const [text, setText] = useState(show(value));
  const [err, setErr] = useState(false);
  useEffect(() => setText(show(value)), [value]);
  const commit = () => {
    const t = text.trim().replace(/\s/g, '').replace(',', '.');
    if (!t) {
      if (allowEmpty) return value !== null && onCommit(null);
      return setErr(true);
    }
    const n = Number(t);
    if (!Number.isFinite(n) || n < 0) return setErr(true);
    if (n !== value) onCommit(n);
  };
  return (
    <View>
      <Field
        label={unit ? `${label} (${unit})` : label}
        value={text}
        onChangeText={(t) => {
          setText(t);
          setErr(false);
        }}
        onBlur={commit}
        keyboardType="decimal-pad"
        placeholder={placeholder}
      />
      {err ? <Text style={{ color: Colors.danger, fontSize: 14 }}>Nombre invalide.</Text> : null}
    </View>
  );
}
