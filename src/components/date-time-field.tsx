import { Field } from '@/components/ui';

// Version native provisoire : saisie texte de la date ISO (le web utilise date-time-field.web.tsx).
export function DateTimeField({ label, value, onChange }: { label: string; value: string; onChange: (iso: string) => void }) {
  return <Field label={label} value={value} onChangeText={onChange} />;
}
