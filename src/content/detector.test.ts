import { describe, it, expect, beforeEach } from 'vitest';
import { detectFormFields } from './detector';

describe('Form Field Detector (src/content/detector.ts)', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('1. detects plain input fields with HTML type, name, and placeholder heuristics', () => {
    document.body.innerHTML = `
      <form id="signup-form">
        <input type="text" name="first_name" placeholder="First name" id="fname" />
        <input type="text" name="last_name" placeholder="Last name" id="lname" />
        <input type="email" name="user_email" id="email" />
        <input type="password" name="password" id="pass" />
        <input type="tel" name="phone_number" id="phone" />
        <input type="hidden" name="csrf_token" value="xyz" />
        <button type="submit">Register</button>
      </form>
    `;

    const result = detectFormFields();
    expect(result.formCount).toBe(1);
    expect(result.fields).toHaveLength(5);

    const types = result.fields.map((f) => f.type);
    expect(types).toContain('first_name');
    expect(types).toContain('last_name');
    expect(types).toContain('email');
    expect(types).toContain('password');
    expect(types).toContain('phone');
  });

  it('2. detects labelled input fields (via <label for="..."> and wrapping <label>)', () => {
    document.body.innerHTML = `
      <form>
        <div>
          <label for="address-input">Street Address</label>
          <input type="text" id="address-input" name="addr" />
        </div>
        <div>
          <label>
            <span>City / Municipality</span>
            <input type="text" name="city_field" />
          </label>
        </div>
        <div>
          <label for="zip-code">Postal / Zip Code</label>
          <input type="text" id="zip-code" />
        </div>
      </form>
    `;

    const result = detectFormFields();
    expect(result.fields).toHaveLength(3);

    const addr = result.fields.find((f) => f.type === 'address_line1');
    expect(addr).toBeDefined();
    expect(addr?.label).toBe('Street Address');

    const city = result.fields.find((f) => f.type === 'city');
    expect(city).toBeDefined();

    const zip = result.fields.find((f) => f.type === 'zip');
    expect(zip).toBeDefined();
    expect(zip?.label).toBe('Postal / Zip Code');
  });

  it('3. detects ARIA-labelled and autocomplete-driven inputs', () => {
    document.body.innerHTML = `
      <div role="form">
        <input type="text" aria-label="Full Name" name="fullname" />
        <input type="text" autocomplete="organization" id="comp" />
        <input type="text" aria-labelledby="job-title-label" id="job" />
        <span id="job-title-label">Job Title</span>
      </div>
    `;

    const result = detectFormFields();
    expect(result.fields.length).toBeGreaterThanOrEqual(2);

    const fullName = result.fields.find((f) => f.type === 'full_name');
    expect(fullName).toBeDefined();

    const company = result.fields.find((f) => f.type === 'company');
    expect(company).toBeDefined();
  });

  it('4. strictly ignores search boxes, filter inputs, and hidden elements', () => {
    document.body.innerHTML = `
      <header>
        <input type="search" placeholder="Search documentation..." name="search" />
        <input type="text" class="filter-input" placeholder="Filter results..." />
        <input type="text" style="display: none;" name="hidden_email" />
      </header>
      <main>
        <input type="email" name="contact_email" placeholder="Contact email" />
      </main>
    `;

    const result = detectFormFields();
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0].type).toBe('email');
  });
});
