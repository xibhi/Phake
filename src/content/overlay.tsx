import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from '../popup/App';
import { useStore } from '../popup/store/useStore';
import { setShadowRootAccessor } from '../lib/design-tokens';
import styles from '../popup/index.css?inline';

let overlayHost: HTMLElement | null = null;
let overlayShadow: ShadowRoot | null = null;
let overlayRoot: ReactDOM.Root | null = null;
let isVisible = false;

export function getOverlayShadowRoot(): ShadowRoot | null {
  return overlayShadow;
}

// Preserved drag position for the current tab session
let sessionLeft: number | null = null;
let sessionTop: number | null = null;

// Clean up listeners state
let isDragging = false;
let dragPointerId: number | null = null;
let dragCleanupFn: (() => void) | null = null;

function endDragging() {
  if (!isDragging && !dragCleanupFn) return;
  isDragging = false;
  dragPointerId = null;
  if (dragCleanupFn) {
    dragCleanupFn();
    dragCleanupFn = null;
  }
}

function applyPosition(host: HTMLElement) {
  if (sessionLeft !== null && sessionTop !== null) {
    host.style.left = `${sessionLeft}px`;
    host.style.top = `${sessionTop}px`;
    host.style.right = 'auto';
  } else {
    host.style.top = '16px';
    host.style.right = '20px';
    host.style.left = 'auto';
  }
}

function onGlobalKeyDown(e: KeyboardEvent) {
  if (e.key !== 'Escape' || !isVisible || !overlayShadow) return;

  const activeEl = overlayShadow.activeElement;
  // If an input or textarea is currently focused, blur it first instead of closing the entire overlay
  if (
    activeEl &&
    (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || (activeEl as HTMLElement).isContentEditable)
  ) {
    (activeEl as HTMLElement).blur();
    e.stopPropagation();
    e.preventDefault();
    return;
  }

  // If a modal dialog is currently rendered inside the overlay, allow modal to handle its own dismiss
  const modalOpen = overlayShadow.querySelector('[role="dialog"], .fixed.inset-0');
  if (modalOpen) {
    return;
  }

  hidePhakeOverlay();
}

function setupDragListeners(shadow: ShadowRoot, host: HTMLElement) {
  const onStartDrag = (event: Event) => {
    const e = event as MouseEvent | PointerEvent;
    // Only drag on primary click / tap
    if (e.button !== 0) return;

    const target = e.target as HTMLElement | null;
    if (!target) return;

    // Must be inside header drag handle area
    const dragHandle = target.closest('[data-drag-handle="true"]') as HTMLElement | null;
    if (!dragHandle) return;

    // Do NOT trigger drag if user clicked a button, input, or link within the header
    if (target.closest('button, input, select, textarea, a')) {
      return;
    }

    e.preventDefault();
    // Clean up any stale drag state
    endDragging();

    isDragging = true;

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const hostRect = host.getBoundingClientRect();
    const initialHostLeft = hostRect.left;
    const initialHostTop = hostRect.top;

    const onMove = (moveEvent: Event) => {
      if (!isDragging) return;
      const me = moveEvent as MouseEvent | PointerEvent;
      me.preventDefault();

      const deltaX = me.clientX - startMouseX;
      const deltaY = me.clientY - startMouseY;

      const newLeft = initialHostLeft + deltaX;
      const newTop = initialHostTop + deltaY;

      const panelWidth = host.offsetWidth || 380;
      // Clamp boundaries: keep at least 40px of the header visible and grabbable at all screen edges
      const minLeft = -(panelWidth - 40);
      const maxLeft = window.innerWidth - 40;
      const minTop = 0;
      const maxTop = window.innerHeight - 40;

      const clampedLeft = Math.max(minLeft, Math.min(maxLeft, newLeft));
      const clampedTop = Math.max(minTop, Math.min(maxTop, newTop));

      host.style.left = `${clampedLeft}px`;
      host.style.top = `${clampedTop}px`;
      host.style.right = 'auto';

      sessionLeft = clampedLeft;
      sessionTop = clampedTop;
    };

    const onEnd = () => {
      endDragging();
    };

    // Capture pointer if available
    if ('setPointerCapture' in dragHandle && 'pointerId' in e) {
      const pe = e as PointerEvent;
      dragPointerId = pe.pointerId;
      try {
        dragHandle.setPointerCapture(pe.pointerId);
      } catch {}
    }

    // Attach listeners on window (capture mode) + shadow + host + document
    window.addEventListener('pointermove', onMove, { passive: false, capture: true });
    window.addEventListener('mousemove', onMove, { passive: false, capture: true });
    window.addEventListener('pointerup', onEnd, { capture: true });
    window.addEventListener('mouseup', onEnd, { capture: true });
    window.addEventListener('pointercancel', onEnd, { capture: true });
    window.addEventListener('blur', onEnd);

    shadow.addEventListener('pointermove', onMove, { passive: false });
    shadow.addEventListener('mousemove', onMove, { passive: false });
    shadow.addEventListener('pointerup', onEnd);
    shadow.addEventListener('mouseup', onEnd);
    shadow.addEventListener('pointercancel', onEnd);

    dragCleanupFn = () => {
      if (dragPointerId !== null && dragHandle && 'releasePointerCapture' in dragHandle) {
        try {
          dragHandle.releasePointerCapture(dragPointerId);
        } catch {}
        dragPointerId = null;
      }
      window.removeEventListener('pointermove', onMove, true);
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('pointerup', onEnd, true);
      window.removeEventListener('mouseup', onEnd, true);
      window.removeEventListener('pointercancel', onEnd, true);
      window.removeEventListener('blur', onEnd);

      shadow.removeEventListener('pointermove', onMove);
      shadow.removeEventListener('mousemove', onMove);
      shadow.removeEventListener('pointerup', onEnd);
      shadow.removeEventListener('mouseup', onEnd);
      shadow.removeEventListener('pointercancel', onEnd);
    };
  };

  shadow.addEventListener('pointerdown', onStartDrag);
  shadow.addEventListener('mousedown', onStartDrag);
}

function setupEventIsolation(shadow: ShadowRoot, host: HTMLElement) {
  // All events that should never leak out of the extension overlay into the host page
  const ISOLATED_EVENTS = [
    // Keyboard events (crucial for stopping keystrokes from leaking into host page chat inputs like Claude.ai)
    'keydown',
    'keyup',
    'keypress',

    // Text & Composition input events
    'input',
    'beforeinput',
    'compositionstart',
    'compositionupdate',
    'compositionend',
    'textInput',

    // Form change & selection
    'change',
    'select',

    // Focus tracking events that cross shadow boundary
    'focusin',
    'focusout',

    // Pointer / Mouse events on inputs and controls
    'click',
    'dblclick',
    'mousedown',
    'mouseup',
    'pointerdown',
    'pointerup',
    'pointercancel',
    'contextmenu',

    // Clipboard operations inside extension UI
    'paste',
    'copy',
    'cut',
  ];

  ISOLATED_EVENTS.forEach((eventName) => {
    // Stop bubbling at the shadow root level
    shadow.addEventListener(eventName, (e: Event) => {
      if ((eventName === 'mouseup' || eventName === 'pointerup' || eventName === 'pointercancel') && isDragging) {
        endDragging();
      }
      e.stopPropagation();
    });

    // Also stop bubbling at the host element level
    host.addEventListener(eventName, (e: Event) => {
      if ((eventName === 'mouseup' || eventName === 'pointerup' || eventName === 'pointercancel') && isDragging) {
        endDragging();
      }
      e.stopPropagation();
      e.stopImmediatePropagation();
    });
  });
}

export function togglePhakeOverlay(): boolean {
  if (overlayHost && document.body.contains(overlayHost)) {
    isVisible = !isVisible;
    overlayHost.style.display = isVisible ? 'flex' : 'none';
    if (isVisible) {
      applyPosition(overlayHost);
      window.addEventListener('keydown', onGlobalKeyDown, true);
      useStore.getState().checkVaultStatus();
      useStore.getState().initSettings();
      useStore.getState().scanActiveTab();
    } else {
      window.removeEventListener('keydown', onGlobalKeyDown, true);
    }
    return isVisible;
  }

  // Create isolated Shadow DOM host container
  overlayHost = document.createElement('div');
  overlayHost.id = 'phake-shadow-host';
  overlayHost.style.position = 'fixed';
  overlayHost.style.zIndex = '2147483647';
  overlayHost.style.pointerEvents = 'auto';
  overlayHost.style.display = 'flex';
  overlayHost.style.borderRadius = '24px';
  overlayHost.style.background = 'transparent';
  applyPosition(overlayHost);

  // SEC-02: Use closed Shadow DOM mode to prevent host page script inspection
  const shadow = overlayHost.attachShadow({ mode: 'closed' });
  overlayShadow = shadow;
  setShadowRootAccessor(() => overlayShadow);

  // Inject compiled Tailwind & extension CSS into shadow root
  const styleEl = document.createElement('style');
  styleEl.textContent = `
    ${styles}
    :host {
      all: initial;
      display: flex;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      line-height: normal;
      letter-spacing: normal;
    }
    #phake-overlay-container {
      display: flex;
      flex-direction: column;
      border-radius: 24px;
      overflow: hidden;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      user-select: none;
      box-sizing: border-box;
    }
    #phake-overlay-container *,
    #phake-overlay-container *::before,
    #phake-overlay-container *::after {
      box-sizing: border-box;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
    }
    #phake-overlay-container input,
    #phake-overlay-container select,
    #phake-overlay-container button,
    #phake-overlay-container textarea {
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
      letter-spacing: normal;
    }
  `;
  shadow.appendChild(styleEl);

  const container = document.createElement('div');
  container.id = 'phake-overlay-container';
  shadow.appendChild(container);

  setupDragListeners(shadow, overlayHost);
  setupEventIsolation(shadow, overlayHost);

  document.body.appendChild(overlayHost);
  isVisible = true;
  window.addEventListener('keydown', onGlobalKeyDown, true);

  overlayRoot = ReactDOM.createRoot(container);
  overlayRoot.render(
    <React.StrictMode>
      <App
        isOverlay={true}
        onClose={() => {
          hidePhakeOverlay();
        }}
      />
    </React.StrictMode>
  );

  // Trigger immediate scan on load
  useStore.getState().scanActiveTab();

  return true;
}

export function hidePhakeOverlay() {
  if (overlayHost) {
    overlayHost.style.display = 'none';
    isVisible = false;
    window.removeEventListener('keydown', onGlobalKeyDown, true);
    endDragging();
  }
}

