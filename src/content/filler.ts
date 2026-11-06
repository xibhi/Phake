import { FillRequest, FillResult } from '../lib/types';

const MONTH_NAMES: Record<string, number> = {
  jan: 1, january: 1, '01': 1, '1': 1,
  feb: 2, february: 2, '02': 2, '2': 2,
  mar: 3, march: 3, '03': 3, '3': 3,
  apr: 4, april: 4, '04': 4, '4': 4,
  may: 5, '05': 5, '5': 5,
  jun: 6, june: 6, '06': 6, '6': 6,
  jul: 7, july: 7, '07': 7, '7': 7,
  aug: 8, august: 8, '08': 8, '8': 8,
  sep: 9, september: 9, '09': 9, '9': 9,
  oct: 10, october: 10, '10': 10,
  nov: 11, november: 11, '11': 11,
  dec: 12, december: 12, '12': 12,
};

/**
 * Set input value using the native prototype setter so React/Vue synthetic event systems
 * accurately detect the property change.
 */
function setNativeValue(
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  value: string
) {
  element.focus();

  if (element instanceof HTMLInputElement) {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;
    if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
  } else if (element instanceof HTMLTextAreaElement) {
    const valueSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;
    if (valueSetter) {
      valueSetter.call(element, value);
    } else {
      element.value = value;
    }
  } else if (element instanceof HTMLSelectElement) {
    let matchedIndex = -1;
    const lowerVal = (value || '').toLowerCase().trim();
    const valNum = parseInt(lowerVal, 10);
    const monthNum = MONTH_NAMES[lowerVal];

    for (let i = 0; i < element.options.length; i++) {
      const opt = element.options[i];
      const optVal = (opt.value || '').toLowerCase().trim();
      const optText = (opt.text || '').toLowerCase().trim();
      const optNum = parseInt(optVal, 10);
      const optTextNum = parseInt(optText, 10);

      // Skip default placeholder options like "(Select Card Type)" or "Month", "Day", "Year"
      if (i === 0 && (optVal === '' || optVal === '0' || optText.includes('select') || optText === 'month' || optText === 'day' || optText === 'year')) {
        continue;
      }

      // 1. Direct string match
      if (optVal === lowerVal || optText === lowerVal) {
        matchedIndex = i;
        break;
      }

      // 2. Month matching (e.g. "Jun" vs "6" or "06" or "June")
      if (monthNum && (MONTH_NAMES[optVal] === monthNum || MONTH_NAMES[optText] === monthNum)) {
        matchedIndex = i;
        break;
      }

      // 3. Number matching (e.g. "01" vs "1", "1995" vs 1995)
      if (!isNaN(valNum) && (optNum === valNum || optTextNum === valNum)) {
        matchedIndex = i;
        break;
      }

      // 4. Gender / Sex matching
      if (
        (lowerVal === 'female' && (optVal === 'f' || optText === 'f' || optVal === 'female')) ||
        (lowerVal === 'male' && (optVal === 'm' || optText === 'm' || optVal === 'male'))
      ) {
        matchedIndex = i;
        break;
      }

      // 5. Card Brand matching (Visa, MasterCard, AmEx, Discover)
      if (
        (lowerVal.includes('visa') && (optVal.includes('visa') || optText.includes('visa'))) ||
        (lowerVal.includes('master') && (optVal.includes('master') || optText.includes('master')))
      ) {
        matchedIndex = i;
        break;
      }

      // 6. Substring inclusion
      if (optText.includes(lowerVal) || lowerVal.includes(optText)) {
        matchedIndex = i;
      }
    }

    if (matchedIndex >= 0) {
      element.selectedIndex = matchedIndex;
      element.value = element.options[matchedIndex].value;
    } else if (element.options.length > 1) {
      element.selectedIndex = 1;
      element.value = element.options[1].value;
    }
  }

  // Dispatch full event sequence to satisfy framework event listeners
  element.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
  element.dispatchEvent(new Event('blur', { bubbles: true }));
}

export function executeFill(request: FillRequest): FillResult {
  let filledCount = 0;
  const errors: string[] = [];

  for (const item of request.fields) {
    try {
      const element = document.querySelector<
        HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
      >(item.selector);

      if (element) {
        setNativeValue(element, item.value);
        filledCount++;

        // Add subtle flash animation to indicate filled field
        const originalTransition = element.style.transition;
        const originalOutline = element.style.outline;
        element.style.transition = 'outline 0.2s ease';
        element.style.outline = '2px solid rgba(48, 209, 88, 0.6)';
        setTimeout(() => {
          element.style.outline = originalOutline;
          element.style.transition = originalTransition;
        }, 1200);
      } else {
        errors.push(`Field not found: ${item.selector}`);
      }
    } catch (err: any) {
      errors.push(`Error filling ${item.selector}: ${err.message}`);
    }
  }

  return {
    success: filledCount > 0,
    filledCount,
    totalCount: request.fields.length,
    errors: errors.length > 0 ? errors : undefined,
  };
}
