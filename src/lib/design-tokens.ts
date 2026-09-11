import { DensityMode } from './types';

export interface DensityDefinition {
  id: DensityMode;
  name: string;
  vars: Record<string, string>;
}

// Prod-matching semi-translucent dark charcoal theme tokens
export const THEME_VARS: Record<string, string> = {
  '--bg-base': 'rgba(36, 36, 36, 0.92)',
  '--bg-surface': 'rgba(48, 48, 48, 0.75)',
  '--bg-surface-hover': 'rgba(60, 60, 60, 0.85)',
  '--border-color': 'rgba(255, 255, 255, 0.08)',
  '--border-subtle': 'rgba(255, 255, 255, 0.05)',
  '--text-primary': '#FFFFFF',
  '--text-muted': '#8E8E93',
  '--text-dim': '#666666',
  '--toggle-track': '#3D3D3D',
  '--toggle-track-on': '#FFFFFF',
  '--toggle-knob': '#FFFFFF',
  '--toggle-knob-on': '#222222',
  '--accent-color': '#FFFFFF',
  '--danger-color': '#FF453A',
  '--success-color': '#30D158',
};

export const DENSITIES: Record<DensityMode, DensityDefinition> = {
  comfortable: {
    id: 'comfortable',
    name: 'Comfortable',
    vars: {
      '--row-padding-y': '11px',
      '--row-padding-x': '14px',
      '--card-gap': '12px',
      '--card-padding': '14px',
      '--input-padding-y': '6px',
      '--font-size-row': '13px',
      '--font-size-sub': '10px',
    },
  },
  compact: {
    id: 'compact',
    name: 'Compact',
    vars: {
      '--row-padding-y': '6px',
      '--row-padding-x': '12px',
      '--card-gap': '8px',
      '--card-padding': '10px',
      '--input-padding-y': '3.5px',
      '--font-size-row': '12px',
      '--font-size-sub': '9.5px',
    },
  },
};

export const SYSTEM_FONT_FAMILY =
  '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

let customShadowRootAccessor: (() => ShadowRoot | null) | null = null;
export function setShadowRootAccessor(accessor: () => ShadowRoot | null) {
  customShadowRootAccessor = accessor;
}

export function applyDesignTokens(
  density: DensityMode = 'comfortable',
  ..._unused: any[]
) {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  const dens = DENSITIES[density] || DENSITIES.comfortable;

  // Apply base theme CSS variables
  Object.entries(THEME_VARS).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });

  // Apply density-specific CSS variables
  Object.entries(dens.vars).forEach(([key, val]) => {
    root.style.setProperty(key, val);
  });

  // Apply font family & data attribute
  root.style.setProperty('--font-family', SYSTEM_FONT_FAMILY);
  root.setAttribute('data-density', density);

  // Also apply directly to Shadow DOM container if injected into page (supports closed mode)
  if (typeof document !== 'undefined') {
    const shadowRoot = customShadowRootAccessor ? customShadowRootAccessor() : null;
    if (shadowRoot) {
      const container = shadowRoot.getElementById('phake-overlay-container');
      if (container) {
        Object.entries(THEME_VARS).forEach(([key, val]) => {
          container.style.setProperty(key, val);
        });
        Object.entries(dens.vars).forEach(([key, val]) => {
          container.style.setProperty(key, val);
        });
        container.setAttribute('data-density', density);
      }
    }
  }
}
