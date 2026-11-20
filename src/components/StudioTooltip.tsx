/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * StudioTooltip — Accessible Custom Tooltip with Shortcut Pill & Touch Suppression
 */

import React, { useId, useState } from 'react';

interface StudioTooltipProps {
  label: string;
  shortcut?: string;
  placement?: 'top' | 'bottom';
  children: React.ReactElement;
}

export const StudioTooltip: React.FC<StudioTooltipProps> = ({
  label,
  shortcut,
  placement = 'bottom',
  children,
}) => {
  const [open, setOpen] = useState(false);
  const tooltipId = useId();

  const isTouchDevice =
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(pointer: coarse)').matches;

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={() => !isTouchDevice && setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => !isTouchDevice && setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {React.cloneElement(children, {
        'aria-describedby': open ? tooltipId : undefined,
      } as Record<string, unknown>)}
      {open && !isTouchDevice && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`pointer-events-none absolute left-1/2 -translate-x-1/2 z-[9998] whitespace-nowrap px-2.5 py-1.5 rounded-lg text-[11px] font-semibold shadow-xl border flex items-center gap-1.5 ${
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
          style={{
            backgroundColor: 'var(--theme-surface, #0f172a)',
            borderColor: 'var(--theme-border, rgba(148,163,184,0.3))',
            color: 'var(--theme-text, #f8fafc)',
          }}
        >
          <span>{label}</span>
          {shortcut && (
            <kbd className="px-1.5 py-0.5 rounded bg-black/15 dark:bg-white/15 font-mono text-[10px]">
              {shortcut}
            </kbd>
          )}
        </span>
      )}
    </span>
  );
};
