import { describe, it, expect } from 'vitest';
import {
  createIdentityContext,
  generateFieldValues,
  getDefaultIdentityFields,
} from './generator';
import { COUNTRIES } from './locales';
import { DetectedField } from './types';

describe('Synthetic Identity Generator (src/lib/generator.ts)', () => {
  const countryCodes = Object.keys(COUNTRIES);

  it('1. should generate valid non-empty identity context for every supported locale', () => {
    expect(countryCodes.length).toBeGreaterThanOrEqual(14);

    for (const code of countryCodes) {
      const identity = createIdentityContext(code);

      // Core identity checks
      expect(identity.countryCode).toBe(code);
      expect(['male', 'female']).toContain(identity.gender);
      expect(['Mr.', 'Ms.', 'Mrs.']).toContain(identity.title);
      expect(identity.firstName).toBeTruthy();
      expect(identity.lastName).toBeTruthy();
      expect(identity.fullName).toContain(identity.firstName);
      expect(identity.fullName).toContain(identity.lastName);

      // Location & address
      expect(identity.street).toBeTruthy();
      expect(identity.addressLine1).toBeTruthy();
      expect(identity.location.city).toBeTruthy();
      expect(identity.location.state).toBeTruthy();
      expect(identity.location.zip).toBeTruthy();

      // Contact & network
      expect(identity.username).toBeTruthy();
      expect(typeof identity.username).toBe('string');
      expect(identity.emailAddress).toContain('@');
      expect(identity.phone).toBeTruthy();

      // Financial & cards
      expect(identity.cardNumber.replace(/\s+/g, '')).toHaveLength(16);
      expect(identity.cardCvv).toMatch(/^\d{3}$/);
      expect(identity.cardExpMonth).toMatch(/^(0[1-9]|1[0-2])$/);
      expect(Number(identity.cardExpYear)).toBeGreaterThanOrEqual(new Date().getFullYear());

      // National IDs
      expect(identity.ssn).toBeTruthy();
      expect(identity.driverLicense).toBeTruthy();

      // Dates of birth
      expect(identity.dob).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(Number(identity.age)).toBeGreaterThanOrEqual(18);
    }
  });

  it('2. should properly map detected form fields to generated context values', () => {
    const context = createIdentityContext('US');
    const fields: DetectedField[] = [
      { id: '1', selector: '#fname', type: 'first_name', label: 'First Name' },
      { id: '2', selector: '#lname', type: 'last_name', label: 'Last Name' },
      { id: '3', selector: '#email', type: 'email', label: 'Email' },
      { id: '4', selector: '#full', type: 'full_name', label: 'Full Name' },
      { id: '5', selector: '#phone', type: 'phone', label: 'Phone' },
    ];

    const values = generateFieldValues(fields, context);
    expect(values).toHaveLength(5);
    expect(values[0].value).toBe(context.firstName);
    expect(values[1].value).toBe(context.lastName);
    expect(values[2].value).toBe(context.emailAddress);
    expect(values[3].value).toBe(context.fullName);
    expect(values[4].value).toBe(context.phone);
  });

  it('3. should generate default comprehensive identity fields list', () => {
    const context = createIdentityContext('GB');
    const defaultFields = getDefaultIdentityFields(context);

    expect(defaultFields.length).toBeGreaterThanOrEqual(15);
    const emailField = defaultFields.find((f) => f.type === 'email');
    expect(emailField).toBeDefined();
    expect(emailField?.value).toContain('@');

    const fullNameField = defaultFields.find((f) => f.type === 'full_name');
    expect(fullNameField).toBeDefined();
    expect(fullNameField?.value).toBe(context.fullName);
  });
});
