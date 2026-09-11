import { DetectedField, FieldType, PageAnalysisResult } from '../lib/types';

// Safe CSS.escape fallback for all environments
export function safeCssEscape(value: string): string {
  if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
    return CSS.escape(value);
  }
  return value.replace(/([!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~])/g, '\\$1');
}

// Canonical friendly labels for field types
export const FIELD_DEFAULT_LABELS: Record<FieldType, string> = {
  title: 'Title (Mr/Ms)',
  first_name: 'First Name',
  middle_name: 'Middle Initial',
  last_name: 'Last Name',
  full_name: 'Full Name',
  email: 'Email Address',
  password: 'Password',
  confirm_password: 'Confirm Password',
  username: 'User ID / Username',
  phone: 'Phone Number',
  phone_home: 'Home Phone',
  phone_work: 'Work Telephone',
  phone_mobile: 'Cell Phone',
  fax: 'Fax Number',
  address_line1: 'Address Line 1',
  address_line2: 'Address Line 2',
  city: 'City',
  state: 'State / Province',
  zip: 'Zip / Postal Code',
  country: 'Country',
  company: 'Company',
  job_title: 'Position / Job Title',
  website: 'Web Site',
  card_type: 'Credit Card Type',
  card_number: 'Credit Card Number',
  card_cvv: 'Card Verification Code',
  card_exp_month: 'Card Expiration Month',
  card_exp_year: 'Card Expiration Year',
  bank_name: 'Card Issuing Bank',
  card_phone: 'Card Customer Service Phone',
  ssn: 'Social Security Number',
  driver_license: 'Driver License Number',
  dob: 'Date of Birth',
  dob_month: 'Birth Month',
  dob_day: 'Birth Day',
  dob_year: 'Birth Year',
  birth_place: 'Birth Place',
  age: 'Age',
  gender: 'Sex / Gender',
  income: 'Income',
  comments: 'Custom Message / Comments',
  custom: 'Text Field',
  middle_initial: 'Middle Initial',
  unknown: 'Field',
};

// Keyword regex patterns with strict priority order
const PATTERNS: { type: FieldType; defaultLabel: string; regex: RegExp }[] = [
  // 1. Password Confirmation
  {
    type: 'confirm_password',
    defaultLabel: 'Confirm Password',
    regex: /(confirm|repeat|retype|re-enter|match|verification|verify).*pass|pass.*(2|confirm|repeat|again)/i,
  },
  // 2. Password
  {
    type: 'password',
    defaultLabel: 'Password',
    regex: /pass(word)?|pwd|secret|auth|login.*pass/i,
  },
  // 3. Email
  {
    type: 'email',
    defaultLabel: 'Email Address',
    regex: /e[\s_-]?mail|user[\s_-]?mail|contact[\s_-]?mail|emailadr|^mail$/i,
  },
  // 4. Card Customer Service Phone & Bank Name
  {
    type: 'card_phone',
    defaultLabel: 'Card Customer Service Phone',
    regex: /card.*phone|customer.*phone|service.*phone|bank.*phone|cccstsvc|cstsvc|cc[\s_-]?phone|ccphone/i,
  },
  {
    type: 'bank_name',
    defaultLabel: 'Card Issuing Bank',
    regex: /issuing[\s_-]?bank|card[\s_-]?bank|bank[\s_-]?name|bank[\s_-]?issuer|ccissuer|issuer|cc[\s_-]?bank|ccbank|^bank$/i,
  },
  // 5. Credit Card Specifics
  {
    type: 'card_type',
    defaultLabel: 'Credit Card Type',
    regex: /credit[\s_-]?card[\s_-]?type|cc[\s_-]?type|card[\s_-]?type|cctype|card[\s_-]?brand/i,
  },
  {
    type: 'card_number',
    defaultLabel: 'Credit Card Number',
    regex: /credit[\s_-]?card[\s_-]?num|cc[\s_-]?num(ber)?|card[\s_-]?num(ber)?|ccnumber|cardnum|credit[\s_-]?card/i,
  },
  {
    type: 'card_cvv',
    defaultLabel: 'Card Verification Code',
    regex: /verification[\s_-]?code|cvc|cvv|security[\s_-]?code|card[\s_-]?code|cid/i,
  },
  {
    type: 'card_exp_month',
    defaultLabel: 'Card Expiration Month',
    regex: /ccexp_mm|cc[\s_-]?exp[\s_-]?m|exp[\s_-]?month|ccexp_m/i,
  },
  {
    type: 'card_exp_year',
    defaultLabel: 'Card Expiration Year',
    regex: /ccexp_yy|cc[\s_-]?exp[\s_-]?y|exp[\s_-]?year|ccexp_y/i,
  },
  // 6. Social Security / Tax ID
  {
    type: 'ssn',
    defaultLabel: 'Social Security Number',
    regex: /social[\s_-]?security|pers[\s_-]?ssn|tax[\s_-]?id|national[\s_-]?id|sin[\s_-]?number|\bssn\b/i,
  },
  // 7. Driver's License
  {
    type: 'driver_license',
    defaultLabel: 'Driver License Number',
    regex: /driver[\s_-]?(lic|license|licence)|drivers?[\s_-]?lic(ense)?|\bdriv_lic\b|\bdrivlic\b|\bdl[\s_-]?(num|number)?\b|\bdlicense\b|dl_number|\bdlnum\b/i,
  },
  // 8. Birth Place (Must precede general birth to prevent "Birth Place" matching "Date of Birth")
  {
    type: 'birth_place',
    defaultLabel: 'Birth Place',
    regex: /birth[\s_-]?place|place[\s_-]?of[\s_-]?birth|born[\s_-]?in|birth[\s_-]?city|birth_pl|birthpl|\bbplace\b|\bb_place\b/i,
  },
  // 9. Date of Birth Components (Month, Day, Year dropdowns)
  {
    type: 'dob_month',
    defaultLabel: 'Birth Month',
    regex: /birth[\s_-]?month|dob[\s_-]?m(onth)?|bday[\s_-]?m(onth)?|b[\s_-]?month|b_m|\b66mm\b|\bmm\b/i,
  },
  {
    type: 'dob_day',
    defaultLabel: 'Birth Day',
    regex: /birth[\s_-]?day|dob[\s_-]?d(ay)?|bday[\s_-]?d(ay)?|b[\s_-]?day|b_d|\b67dd\b|\bdd\b/i,
  },
  {
    type: 'dob_year',
    defaultLabel: 'Birth Year',
    regex: /birth[\s_-]?year|dob[\s_-]?y(ear)?|bday[\s_-]?y(ear)?|b[\s_-]?year|b_y|\b68yy\b|\byy\b/i,
  },
  {
    type: 'dob',
    defaultLabel: 'Date of Birth',
    regex: /date[\s_-]?of[\s_-]?birth|\bdob\b|\bbday\b|^birth$/i,
  },
  // 10. Age
  {
    type: 'age',
    defaultLabel: 'Age',
    regex: /(^|[\d_-\s])age([\d_-\s]|$)|years[\s_-]?old|pers_age/i,
  },
  // 11. Income / Salary
  {
    type: 'income',
    defaultLabel: 'Income',
    regex: /income|salary|earnings|revenue|gross[\s_-]?pay/i,
  },
  // 12. Comments / Feedback / Custom Message
  {
    type: 'comments',
    defaultLabel: 'Custom Message / Comments',
    regex: /custom[\s_-]?message|comment|message|notes|feedback|description|memo|remarks|custom|commnt/i,
  },
  // 13. Salutation / Name Title
  {
    type: 'title',
    defaultLabel: 'Title (Mr/Ms)',
    regex: /(^|[\d_-\s])title([\d_-\s]|$)|salutation|honorific|prefix|mr[\s_-]?ms|name_prefix|name_title/i,
  },
  // 14. Middle Initial / Middle Name
  {
    type: 'middle_name',
    defaultLabel: 'Middle Initial',
    regex: /middle[\s_-]?(name|initial|i)?|\bmname\b|\bm_initial\b|mid[\s_-]?name|middle_i|\bmid\b/i,
  },
  // 15. First Name
  {
    type: 'first_name',
    defaultLabel: 'First Name',
    regex: /first[\s_-]?name|\bfname\b|frst[\s_-]?name|given[\s_-]?name|forename|prénom|vorname/i,
  },
  // 16. Last Name
  {
    type: 'last_name',
    defaultLabel: 'Last Name',
    regex: /last[\s_-]?name|\blname\b|lst[\s_-]?name|family[\s_-]?name|surname|nachname|\bnom\b/i,
  },
  // 17. Full Name / General Name / Card User Name
  {
    type: 'full_name',
    defaultLabel: 'Full Name',
    regex: /card[\s_-]?user|cardholder|cc_uname|ccuname|full[\s_-]?name|fullname|complete[\s_-]?name|your[\s_-]?name|contact[\s_-]?name|display[\s_-]?name|customer[\s_-]?name|owner|\bname\b/i,
  },
  // 18. Username / User ID
  {
    type: 'username',
    defaultLabel: 'User ID / Username',
    regex: /user[\s_-]?id|user[\s_-]?name|screen[\s_-]?name|login[\s_-]?id|nickname|handle/i,
  },
  // 19. Phone Variations (Home, Work, Cell, Fax, Phone)
  {
    type: 'phone_home',
    defaultLabel: 'Home Phone',
    regex: /home[\s_-]?(phone|tel)|homephon|residential[\s_-]?phone|h_phone|phone_h/i,
  },
  {
    type: 'phone_work',
    defaultLabel: 'Work Telephone',
    regex: /work[\s_-]?(phone|tel|telephone)|workphon|business[\s_-]?phone|office[\s_-]?phone|w_phone|phone_w/i,
  },
  {
    type: 'phone_mobile',
    defaultLabel: 'Cell Phone',
    regex: /cell[\s_-]?(phone|tel)?|cellphon|mobile[\s_-]?(phone|tel)?|m_phone|c_phone/i,
  },
  {
    type: 'fax',
    defaultLabel: 'Fax Number',
    regex: /fax|faxphone/i,
  },
  {
    type: 'phone',
    defaultLabel: 'Phone Number',
    regex: /phone|tel|telephone|contact[\s_-]?num/i,
  },
  // 20. Position / Job Title
  {
    type: 'job_title',
    defaultLabel: 'Position / Job Title',
    regex: /position|job[\s_-]?title|occupation|profession|role/i,
  },
  // 21. Street Address Lines
  {
    type: 'address_line2',
    defaultLabel: 'Address Line 2',
    regex: /address[\s_-]?(line)?[\s_-]?2|address2|apt|suite|unit|bldg|addr2|street2/i,
  },
  {
    type: 'address_line1',
    defaultLabel: 'Address Line 1',
    regex: /address[\s_-]?(line)?[\s_-]?1|address1|street[\s_-]?address|street|addr1|address$|addr$/i,
  },
  // 22. City, State, Zip, Country
  {
    type: 'city',
    defaultLabel: 'City',
    regex: /city|adr_city|town|suburb|locality|ville|ort/i,
  },
  {
    type: 'state',
    defaultLabel: 'State / Province',
    regex: /state|adrstate|province|region|county|prefecture|bundesland|state_prov/i,
  },
  {
    type: 'zip',
    defaultLabel: 'Zip / Postal Code',
    regex: /zip|addr_zip|postal|postcode|pincode|plz|zip[\s_-]?code/i,
  },
  {
    type: 'country',
    defaultLabel: 'Country',
    regex: /country|nation|land|pays/i,
  },
  // 23. Company & Web Site
  {
    type: 'company',
    defaultLabel: 'Company',
    regex: /company|organization|org|business|corp|employer/i,
  },
  {
    type: 'website',
    defaultLabel: 'Web Site',
    regex: /web[\s_-]?site|web[\s_-]?page|url|homepage|25web_site/i,
  },
  // 24. Gender / Sex
  {
    type: 'gender',
    defaultLabel: 'Sex / Gender',
    regex: /gender|sex|pers_sex|genre/i,
  },
];

const AUTOCOMPLETE_MAP: Record<string, { type: FieldType; label: string }> = {
  'honorific-prefix': { type: 'title', label: 'Title (Mr/Ms)' },
  'given-name': { type: 'first_name', label: 'First Name' },
  'additional-name': { type: 'middle_name', label: 'Middle Initial' },
  'family-name': { type: 'last_name', label: 'Last Name' },
  name: { type: 'full_name', label: 'Full Name' },
  email: { type: 'email', label: 'Email Address' },
  username: { type: 'username', label: 'User ID / Username' },
  'new-password': { type: 'password', label: 'Password' },
  'current-password': { type: 'password', label: 'Password' },
  tel: { type: 'phone', label: 'Phone Number' },
  'tel-national': { type: 'phone', label: 'Phone Number' },
  'address-line1': { type: 'address_line1', label: 'Address Line 1' },
  'street-address': { type: 'address_line1', label: 'Address Line 1' },
  'address-line2': { type: 'address_line2', label: 'Address Line 2' },
  'address-level2': { type: 'city', label: 'City' },
  'address-level1': { type: 'state', label: 'State / Province' },
  'postal-code': { type: 'zip', label: 'Zip / Postal Code' },
  'country-name': { type: 'country', label: 'Country' },
  country: { type: 'country', label: 'Country' },
  organization: { type: 'company', label: 'Company' },
  'organization-title': { type: 'job_title', label: 'Position / Job Title' },
  url: { type: 'website', label: 'Web Site' },
  'cc-type': { type: 'card_type', label: 'Credit Card Type' },
  'cc-number': { type: 'card_number', label: 'Credit Card Number' },
  'cc-csc': { type: 'card_cvv', label: 'Card Verification Code' },
  'cc-exp-month': { type: 'card_exp_month', label: 'Card Expiration Month' },
  'cc-exp-year': { type: 'card_exp_year', label: 'Card Expiration Year' },
  bday: { type: 'dob', label: 'Date of Birth' },
  'bday-day': { type: 'dob_day', label: 'Birth Day' },
  'bday-month': { type: 'dob_month', label: 'Birth Month' },
  'bday-year': { type: 'dob_year', label: 'Birth Year' },
  sex: { type: 'gender', label: 'Sex / Gender' },
};

/**
 * Filter out non-personal user fields (search boxes, filter bars, article queries)
 */
export function isSearchOrFilterField(el: HTMLElement, type: string, tokens: string): boolean {
  if (type === 'search') return true;

  const role = el.getAttribute('role')?.toLowerCase();
  if (role === 'search' || role === 'searchbox') return true;
  if (el.closest && el.closest('[role="search"]')) return true;

  const name = (el.getAttribute('name') || '').toLowerCase();
  const id = (el.id || '').toLowerCase();
  const placeholder = (el.getAttribute('placeholder') || '').toLowerCase();
  const ariaLabel = (el.getAttribute('aria-label') || '').toLowerCase();

  // Search input name / id heuristics
  if (['q', 's', 'query', 'k', 'keyword', 'search', 'filter', 'search_query', 'search_term', 'term', 'searchinput'].includes(name)) {
    return true;
  }
  if (['search', 'filter', 'query', 'searchbox', 'search-input', 'search_input', 'site-search'].includes(id)) {
    return true;
  }

  // Search / filter phrases in placeholder or labels
  const SEARCH_PHRASES = [
    'search', 'filter', 'type to filter', 'filter by', 'find', 'lookup',
    'search here', 'search docs', 'search articles', 'search site', 'search query',
    'search website', 'quick find', 'site search', 'search products'
  ];

  for (const phrase of SEARCH_PHRASES) {
    if (placeholder.includes(phrase) || ariaLabel.includes(phrase)) {
      return true;
    }
  }

  // Parent form search role
  const form = el.closest ? el.closest('form') : null;
  if (form) {
    const formClass = form.className?.toString().toLowerCase() || '';
    const formId = form.id?.toLowerCase() || '';
    const formAction = form.getAttribute('action')?.toLowerCase() || '';
    if (
      form.getAttribute('role') === 'search' ||
      formClass.includes('search') ||
      formId.includes('search') ||
      formAction.includes('search')
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Humanize raw field tokens into clean title case
 */
export function cleanRawFieldName(raw: string): string {
  if (!raw) return '';

  let cleaned = raw.replace(/^[\d_-]+/, '');

  if (/^title$/i.test(cleaned)) return 'Title';
  if (/frstname/i.test(cleaned)) return 'First Name';
  if (/lastname/i.test(cleaned)) return 'Last Name';
  if (/fullname/i.test(cleaned)) return 'Full Name';
  if (/^fname$/i.test(cleaned)) return 'First Name';
  if (/^lname$/i.test(cleaned)) return 'Last Name';
  if (/middle_i|middle_initial/i.test(cleaned)) return 'Middle Initial';
  if (/^mname$/i.test(cleaned)) return 'Middle Name';
  if (/web_site|website/i.test(cleaned)) return 'Web Site';
  if (/cc_type|cctype/i.test(cleaned)) return 'Credit Card Type';
  if (/ccnumber|cc_num/i.test(cleaned)) return 'Credit Card Number';
  if (/cvc|cvv|verification/i.test(cleaned)) return 'Card Verification Code';
  if (/addr1|address1/i.test(cleaned)) return 'Address Line 1';
  if (/addr2|address2/i.test(cleaned)) return 'Address Line 2';
  if (/useremail|emailadr/i.test(cleaned)) return 'Email Address';
  if (/postcode|addr_zip/i.test(cleaned)) return 'Postal Code';
  if (/zipcode/i.test(cleaned)) return 'Zip Code';
  if (/adr_city/i.test(cleaned)) return 'City';
  if (/adrstate/i.test(cleaned)) return 'State / Province';
  if (/^company$/i.test(cleaned)) return 'Company';
  if (/pers_ssn|ssn/i.test(cleaned)) return 'Social Security Number';
  if (/driv_lic|driver_license|dl_num|dlicense|dl_number/i.test(cleaned)) return 'Driver License Number';
  if (/birth_pl|birth_place|place_of_birth|bplace/i.test(cleaned)) return 'Birth Place';
  if (/pers_age|^age$/i.test(cleaned)) return 'Age';
  if (/ccissuer|issuing_bank|card_bank|cc_bank/i.test(cleaned)) return 'Card Issuing Bank';
  if (/cccstsvc|customer_service_phone|cc_phone/i.test(cleaned)) return 'Card Customer Service Phone';
  if (/cc_uname|ccuname/i.test(cleaned)) return 'Card User Name';
  if (/homephon|h_phone|home_phone/i.test(cleaned)) return 'Home Phone';
  if (/workphon|w_phone|work_phone|work_tel/i.test(cleaned)) return 'Work Telephone';
  if (/cellphon|c_phone|cell_phone/i.test(cleaned)) return 'Cell Phone';
  if (/faxphone|fax/i.test(cleaned)) return 'Fax Number';
  if (/commnt|comment/i.test(cleaned)) return 'Comments';
  if (/custom/i.test(cleaned)) return 'Custom Message';
  if (/pers_sex/i.test(cleaned)) return 'Sex';
  if (/income/i.test(cleaned)) return 'Income';

  cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');
  cleaned = cleaned.replace(/[-_.]+/g, ' ').trim();

  return cleaned
    .split(' ')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function getUniqueSelector(el: HTMLElement): string {
  if (el.id) {
    const escapedId = safeCssEscape(el.id);
    return `#${escapedId}`;
  }

  if (el.getAttribute('name')) {
    const name = el.getAttribute('name')!;
    const selector = `${el.tagName.toLowerCase()}[name="${safeCssEscape(name)}"]`;
    if (document.querySelectorAll(selector).length === 1) {
      return selector;
    }
  }

  const path: string[] = [];
  let current: HTMLElement | null = el;

  while (current && current !== document.body) {
    const tag = current.tagName.toLowerCase();
    const parent: HTMLElement | null = current.parentElement;
    if (parent) {
      const children = Array.from(parent.children).filter((c) => c.tagName === current!.tagName);
      if (children.length > 1) {
        const index = children.indexOf(current) + 1;
        path.unshift(`${tag}:nth-of-type(${index})`);
      } else {
        path.unshift(tag);
      }
    } else {
      path.unshift(tag);
    }
    current = parent;
  }

  return `body > ${path.join(' > ')}`;
}

/**
 * Universal label resolver supporting <label>, Bootstrap/Tailwind grid columns (.row > .col), tables (<td>), aria attributes, and siblings
 */
function findLabelText(el: HTMLElement): string {
  let labelText = '';

  // 1. Explicit <label for="id">
  if (el.id) {
    const label = document.querySelector(`label[for="${safeCssEscape(el.id)}"]`);
    if (label && label.textContent) {
      labelText = label.textContent.trim();
    }
  }

  // 2. Parent <label>
  if (!labelText && el.closest) {
    const parentLabel = el.closest('label');
    if (parentLabel && parentLabel.textContent) {
      labelText = parentLabel.textContent.trim();
    }
  }

  // 3. aria-label or aria-labelledby (Explicit ARIA accessibility labels)
  if (!labelText) {
    const ariaLabel = el.getAttribute('aria-label');
    if (ariaLabel) labelText = ariaLabel.trim();
  }

  if (!labelText) {
    const ariaLabelledby = el.getAttribute('aria-labelledby');
    if (ariaLabelledby) {
      const labelledEl = document.getElementById(ariaLabelledby);
      if (labelledEl && labelledEl.textContent) {
        labelText = labelledEl.textContent.trim();
      }
    }
  }

  // 4. Grid Row / Form-Group Sibling Column (Bootstrap `.row > .col`, Tailwind grid/flex rows)
  if (!labelText) {
    let container: HTMLElement | null = el;
    for (let depth = 0; depth < 3 && container && container !== document.body; depth++) {
      if (container.previousElementSibling) {
        const prevText = container.previousElementSibling.textContent?.trim();
        if (prevText && prevText.length > 0 && prevText.length <= 60 && !prevText.includes('\n')) {
          labelText = prevText;
          break;
        }
      }
      container = container.parentElement;
    }
  }

  // 5. Table Layout: Preceding <td> in same <tr>
  if (!labelText && el.closest) {
    const td = el.closest('td');
    if (td && td.previousElementSibling) {
      const prevTdText = td.previousElementSibling.textContent?.trim();
      if (prevTdText && prevTdText.length <= 60) {
        labelText = prevTdText;
      }
    }
  }

  // 6. Table Header in <tr>
  if (!labelText && el.closest) {
    const tr = el.closest('tr');
    if (tr) {
      const th = tr.querySelector('th');
      if (th && th.textContent && th.textContent.trim().length <= 60) {
        labelText = th.textContent.trim();
      }
    }
  }

  // 7. Direct preceding sibling (SPAN, LABEL, P, DIV, B, STRONG)
  if (!labelText) {
    const prev = el.previousElementSibling;
    if (prev && prev.textContent && prev.textContent.trim().length <= 60) {
      labelText = prev.textContent.trim();
    }
  }

  if (labelText) {
    labelText = labelText.replace(/[*:#\s]+$/, '').trim();
  }

  return labelText;
}

function isPhakeInternalElement(el: HTMLElement): boolean {
  try {
    if (el.closest && (
      el.closest('#phake-shadow-host') ||
      el.closest('#phake-overlay-container') ||
      el.closest('[data-phake-internal]')
    )) {
      return true;
    }
    const root = el.getRootNode ? el.getRootNode() : null;
    if (root && root !== document) {
      if (typeof ShadowRoot !== 'undefined' && root instanceof ShadowRoot) {
        const host = root.host;
        if (host && (host.id === 'phake-shadow-host' || host.tagName.toLowerCase().includes('phake'))) {
          return true;
        }
      }
    }
  } catch {}
  return false;
}

function isInternalOrMasterPasswordField(tokens: string): boolean {
  return /master[\s_-]?pass|masterpassword|security[\s_-]?question|security[\s_-]?answer/i.test(tokens);
}

function isElementVisible(el: HTMLElement): boolean {
  if (el.style.display === 'none' || el.style.visibility === 'hidden' || el.style.opacity === '0') {
    return false;
  }
  if (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') {
    const style = window.getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
      return false;
    }
  }
  return true;
}

export function detectFormFields(): PageAnalysisResult {
  const inputs = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(
      'input, select, textarea'
    )
  );

  const detected: DetectedField[] = [];
  let fieldIndex = 0;

  for (const el of inputs) {
    if (isPhakeInternalElement(el)) {
      continue;
    }

    const type = (el.getAttribute('type') || 'text').toLowerCase();
    if (['hidden', 'submit', 'button', 'reset', 'image', 'file'].includes(type)) {
      continue;
    }

    if (!isElementVisible(el)) {
      continue;
    }

    const autocomplete = el.getAttribute('autocomplete')?.toLowerCase();
    const rawName = el.getAttribute('name') || '';
    const rawId = el.id || '';
    const placeholder = el.getAttribute('placeholder') || '';
    const pageLabel = findLabelText(el);
    const tokens = `${rawName} ${rawId} ${cleanRawFieldName(rawName)} ${cleanRawFieldName(rawId)} ${placeholder} ${pageLabel} ${el.className}`;

    // STRICT CHECK: Exclude internal master password fields, search boxes, filter bars
    if (isInternalOrMasterPasswordField(tokens) || isSearchOrFilterField(el, type, tokens)) {
      continue;
    }

    let matchedType: FieldType | null = null;
    let matchedLabel = '';

    // 1. Check autocomplete attribute first
    if (autocomplete && AUTOCOMPLETE_MAP[autocomplete]) {
      matchedType = AUTOCOMPLETE_MAP[autocomplete].type;
      matchedLabel = pageLabel || AUTOCOMPLETE_MAP[autocomplete].label;
    }
    // 2. Check HTML type attribute
    else if (type === 'email') {
      matchedType = 'email';
      matchedLabel = pageLabel || 'Email Address';
    } else if (type === 'password') {
      const combined = `${rawName} ${rawId} ${placeholder} ${pageLabel}`;
      if (PATTERNS[0].regex.test(combined)) {
        matchedType = 'confirm_password';
        matchedLabel = pageLabel || 'Confirm Password';
      } else {
        matchedType = 'password';
        matchedLabel = pageLabel || 'Password';
      }
    } else if (type === 'tel') {
      matchedType = 'phone';
      matchedLabel = pageLabel || 'Phone Number';
    }
    // 3. Keyword pattern matching on combined text tokens
    else {
      for (const pattern of PATTERNS) {
        if (pattern.regex.test(tokens)) {
          matchedType = pattern.type;
          matchedLabel = pageLabel || pattern.defaultLabel;
          break;
        }
      }
    }

    // STRICT IDENTITY FILTER: If an input is not a recognized personal user identity field, skip it!
    if (!matchedType) {
      continue;
    }

    if (!matchedLabel || /^field_\d+/i.test(matchedLabel) || /^\d+__/i.test(matchedLabel)) {
      matchedLabel = FIELD_DEFAULT_LABELS[matchedType] || cleanRawFieldName(rawName || rawId) || 'Field';
    }

    const selector = getUniqueSelector(el);
    fieldIndex++;

    detected.push({
      id: `field_${fieldIndex}_${matchedType}`,
      type: matchedType,
      label: matchedLabel,
      selector,
      name: rawName,
      placeholder,
      autocomplete,
      currentValue: el.value,
    });
  }

  let faviconUrl = '';
  const faviconEl = document.querySelector<HTMLLinkElement>(
    'link[rel="icon"], link[rel="shortcut icon"], link[rel="apple-touch-icon"]'
  );
  if (faviconEl && faviconEl.href) {
    faviconUrl = faviconEl.href;
  } else {
    faviconUrl = `https://www.google.com/s2/favicons?domain=${window.location.hostname}&sz=64`;
  }

  return {
    url: window.location.href,
    hostname: window.location.hostname,
    title: document.title || window.location.hostname,
    faviconUrl,
    fields: detected,
    formCount: document.forms.length,
    timestamp: Date.now(),
  };
}
