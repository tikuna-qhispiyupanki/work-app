import { Field } from '@/components/ui';

// Version native provisoire : saisie « AAAA-MM-JJ » (le web utilise date-field.web.tsx).
export function DateField({ label, value, onChange }: { label: string; value: string | null; onChange: (day: string | null) => void }) {
  return <Field label={label} value={value ?? ''} onChangeText={(t) => onChange(t || null)} />;
}
