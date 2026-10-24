import type { ReactNode } from 'react';

export function FieldGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <fieldset className="group">
      <legend>{title}</legend>
      <div className="fields">{children}</div>
    </fieldset>
  );
}

export function NumberField({
  label,
  value,
  onChange,
  unit,
  step = 'any',
  min,
  max,
  hint,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  unit?: string;
  step?: number | 'any';
  min?: number;
  max?: number;
  hint?: string;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-control">
        <input
          type="number"
          inputMode="decimal"
          value={Number.isFinite(value) ? value : ''}
          step={step}
          min={min}
          max={max}
          onChange={(event) => {
            const raw = event.target.value;
            onChange(raw === '' ? Number.NaN : Number(raw));
          }}
        />
        {unit ? <span className="unit">{unit}</span> : null}
      </span>
      {hint ? <span className="hint">{hint}</span> : null}
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="field-control">
        <input value={value} onChange={(event) => onChange(event.target.value)} />
      </span>
    </label>
  );
}

export function CheckField({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  hint?: string;
}) {
  return (
    <label className="check">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className="field-label">{label}</span>
        {hint ? <span className="hint">{hint}</span> : null}
      </span>
    </label>
  );
}

export function Facts({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <dl className="facts">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function StatusLine({ warnings }: { warnings: string[] }) {
  const check = warnings.length > 0;
  return (
    <p className="status-line">
      <span>Status</span>
      <strong className={check ? 'pill pill-check' : 'pill'}>{check ? 'CHECK' : 'NOMINAL'}</strong>
    </p>
  );
}

export function Warnings({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="warnings">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
