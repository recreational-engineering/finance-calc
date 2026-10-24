import { useId, type ReactNode } from 'react';

export function ColumnHeader({ left, right }: { left: string; right: string }) {
  return (
    <div className="setting-columns">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}

export function SettingsPanel({ children }: { children: ReactNode }) {
  return (
    <section className="panel settings">
      <ColumnHeader left="Setting" right="Value" />
      {children}
    </section>
  );
}

export function FieldGroup({
  title,
  children,
  collapsed = false,
}: {
  title: string;
  children: ReactNode;
  collapsed?: boolean;
}) {
  if (collapsed) {
    return (
      <details
        className="setting-group"
        onToggle={(event) => {
          const details = event.currentTarget;
          if (!details.open) return;
          const scroller = details.closest('.settings');
          if (!(scroller instanceof HTMLElement)) return;
          const delta = details.getBoundingClientRect().top - scroller.getBoundingClientRect().top;
          scroller.scrollBy({ top: delta - 8 });
        }}
      >
        <summary>{title}</summary>
        <div className="setting-list">{children}</div>
      </details>
    );
  }
  return (
    <section className="setting-group">
      <h3>{title}</h3>
      <div className="setting-list">{children}</div>
    </section>
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
  hint?: ReactNode;
}) {
  return (
    <label className="setting">
      <span className="setting-copy">
        <span className="setting-label">{label}</span>
        {hint ? <span className="setting-hint">{hint}</span> : null}
      </span>
      <span className="setting-control">
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
    </label>
  );
}

export function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="setting">
      <span className="setting-copy">
        <span className="setting-label">{label}</span>
      </span>
      <span className="setting-control">
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
        />
      </span>
    </label>
  );
}

export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="setting">
      <span className="setting-copy">
        <span className="setting-label">{label}</span>
      </span>
      <span className="setting-control">
        <input type="date" value={value} onChange={(event) => onChange(event.target.value)} />
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
  const id = useId();
  return (
    <div className="setting">
      <span className="setting-copy">
        <span className="setting-label" id={id}>
          {label}
        </span>
        {hint ? <span className="setting-hint">{hint}</span> : null}
      </span>
      <div className="segment segment-binary" role="group" aria-labelledby={id}>
        <button type="button" aria-pressed={!checked} onClick={() => onChange(false)}>
          Off
        </button>
        <button type="button" aria-pressed={checked} onClick={() => onChange(true)}>
          On
        </button>
      </div>
    </div>
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
      <strong className={check ? 'pill pill-check' : 'pill'}>{check ? 'CHECK' : 'OK'}</strong>
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
