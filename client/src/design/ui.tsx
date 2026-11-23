/**
 * Aastha UI kit, Material You (content) × Liquid Glass (controls).
 * Use these instead of hand-rolled bg-white/5 boxes so every screen follows the user's seed colour,
 * light/dark contrast stays checked, and lite mode works automatically.
 * Rule of thumb: Card/ListItem/Button = tonal Material surfaces; GlassBar = floating control layer only.
 */
import React from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

/* ---------- Surfaces ---------- */
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement> & { level?: 1 | 2 | 3; padded?: boolean }> = ({ level = 2, padded = true, className, ...rest }) => (
  <div
    {...rest}
    className={cx(
      'rounded-[24px] border border-md-outline-variant/30',
      level === 1 ? 'bg-md-surface-container-low' : level === 2 ? 'bg-md-surface-container' : 'bg-md-surface-container-high',
      padded && 'p-4',
      className,
    )}
  />
);

export const SectionTitle: React.FC<{ children: React.ReactNode; className?: string; action?: React.ReactNode }> = ({ children, className, action }) => (
  <div className={cx('flex items-center justify-between px-1 mb-2', className)}>
    <h3 className="text-sm font-medium tracking-wide text-md-primary">{children}</h3>
    {action}
  </div>
);

/* ---------- Switch (M3) ---------- */
export const Switch: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={(e) => { e.stopPropagation(); onChange(!checked); }}
    className={cx(
      'relative shrink-0 w-[52px] h-8 rounded-full transition-colors duration-200 ease-md-emphasized disabled:opacity-40',
      checked ? 'bg-md-primary' : 'bg-md-surface-container-highest border-2 border-md-outline',
    )}
  >
    <span
      className={cx(
        'absolute top-1/2 -translate-y-1/2 rounded-full transition-all duration-200 ease-md-emphasized',
        checked ? 'left-[24px] w-6 h-6 bg-md-on-primary' : 'left-[6px] w-4 h-4 bg-md-outline',
      )}
    />
  </button>
);

/* ---------- Buttons ---------- */
type BtnVariant = 'filled' | 'tonal' | 'outlined' | 'text' | 'danger';
export const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; icon?: React.ReactNode; size?: 'md' | 'lg' }> = ({ variant = 'filled', icon, size = 'md', className, children, ...rest }) => (
  <button
    {...rest}
    className={cx(
      'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-all duration-200 ease-md-emphasized active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none',
      size === 'lg' ? 'h-14 px-6 text-base' : 'h-10 px-5 text-sm',
      variant === 'filled' && 'bg-md-primary text-md-on-primary hover:brightness-110 shadow-sm',
      variant === 'tonal' && 'bg-md-secondary-container text-md-on-secondary-container hover:brightness-110',
      variant === 'outlined' && 'border border-md-outline text-md-primary hover:bg-md-primary/10',
      variant === 'text' && 'text-md-primary hover:bg-md-primary/10 px-3',
      variant === 'danger' && 'bg-md-error-container text-md-on-error-container hover:brightness-110',
      className,
    )}
  >
    {icon}{children}
  </button>
);

export const IconButton: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'standard' | 'tonal' | 'filled' | 'glass'; label: string; size?: 'sm' | 'md' | 'lg' }> = ({ variant = 'standard', label, size = 'md', className, children, ...rest }) => (
  <button
    {...rest}
    aria-label={label}
    title={label}
    className={cx(
      'inline-flex items-center justify-center rounded-full transition-all duration-200 ease-md-emphasized active:scale-95 disabled:opacity-40',
      size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-14 h-14' : 'w-10 h-10',
      variant === 'standard' && 'text-md-on-surface-variant hover:bg-md-on-surface/10',
      variant === 'tonal' && 'bg-md-secondary-container text-md-on-secondary-container hover:brightness-110',
      variant === 'filled' && 'bg-md-primary text-md-on-primary hover:brightness-110',
      variant === 'glass' && 'glass glass-pill text-md-on-surface hover:brightness-110',
      className,
    )}
  >
    {children}
  </button>
);

/* ---------- Lists ---------- */
export const ListItem: React.FC<{
  icon?: React.ReactNode; title: React.ReactNode; subtitle?: React.ReactNode; trailing?: React.ReactNode;
  onClick?: () => void; active?: boolean; danger?: boolean; className?: string;
}> = ({ icon, title, subtitle, trailing, onClick, active, danger, className }) => {
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick } : {})}
      className={cx(
        'w-full flex items-center gap-4 px-4 py-3 min-h-[64px] text-left transition-colors',
        onClick && 'hover:bg-md-on-surface/[0.06] active:bg-md-on-surface/10',
        active && 'bg-md-secondary-container',
        className,
      )}
    >
      {icon && (
        <span className={cx('shrink-0 w-10 h-10 rounded-full flex items-center justify-center',
          danger ? 'bg-md-error-container text-md-on-error-container' : active ? 'bg-md-primary text-md-on-primary' : 'bg-md-secondary-container text-md-on-secondary-container')}>
          {icon}
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className={cx('block text-[15px] font-medium truncate', danger ? 'text-md-error' : 'text-md-on-surface')}>{title}</span>
        {subtitle && <span className="block text-xs text-md-on-surface-variant mt-0.5 leading-snug">{subtitle}</span>}
      </span>
      {trailing && <span className="shrink-0 flex items-center">{trailing}</span>}
    </Tag>
  );
};

/** A group of list items on one tonal card with hairline dividers (Android-settings style). */
export const ListGroup: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={cx('rounded-[24px] overflow-hidden bg-md-surface-container border border-md-outline-variant/30 divide-y divide-md-outline-variant/30', className)}>
    {children}
  </div>
);

/* ---------- Segmented button (M3) ---------- */
export function Segmented<T extends string>({ options, value, onChange, className, size = 'md' }: {
  options: { value: T; label: React.ReactNode; icon?: React.ReactNode }[]; value: T; onChange: (v: T) => void; className?: string; size?: 'sm' | 'md';
}) {
  return (
    <div role="radiogroup" className={cx('flex rounded-full border border-md-outline overflow-hidden', className)}>
      {options.map((o, i) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cx(
              'flex-1 inline-flex items-center justify-center gap-1.5 font-medium transition-colors min-w-0',
              size === 'sm' ? 'h-8 px-2 text-xs' : 'h-10 px-3 text-sm',
              i > 0 && 'border-l border-md-outline',
              on ? 'bg-md-secondary-container text-md-on-secondary-container' : 'text-md-on-surface hover:bg-md-on-surface/[0.06]',
            )}
          >
            {o.icon}<span className="truncate">{o.label}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Chips ---------- */
export const Chip: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement> & { selected?: boolean; icon?: React.ReactNode }> = ({ selected, icon, className, children, ...rest }) => (
  <button
    type="button"
    {...rest}
    aria-pressed={selected}
    className={cx(
      'inline-flex items-center gap-1.5 h-8 px-3 rounded-[8px] text-sm font-medium transition-colors whitespace-nowrap',
      selected ? 'bg-md-secondary-container text-md-on-secondary-container' : 'border border-md-outline-variant text-md-on-surface-variant hover:bg-md-on-surface/[0.06]',
      className,
    )}
  >
    {icon}{children}
  </button>
);

/* ---------- Glass top bar (control layer) ---------- */
export const GlassBar: React.FC<{ title?: React.ReactNode; leading?: React.ReactNode; trailing?: React.ReactNode; className?: string; children?: React.ReactNode }> = ({ title, leading, trailing, className, children }) => (
  <div className={cx('glass rounded-[24px] flex items-center gap-2 px-2 h-14', className)}>
    {leading}
    {title && <div className="flex-1 min-w-0 px-2 text-base font-medium text-md-on-surface truncate">{title}</div>}
    {children}
    {trailing && <div className="flex items-center gap-1 ml-auto">{trailing}</div>}
  </div>
);

/* ---------- Text field / select ---------- */
export const fieldClass = 'w-full h-12 px-4 rounded-[12px] bg-md-surface-container-highest text-md-on-surface placeholder:text-md-on-surface-variant/70 border border-transparent focus:border-md-primary focus:outline-none transition-colors';
