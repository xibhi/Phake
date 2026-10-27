import { COUNTRIES, CountryLocale } from './locales';
import { DetectedField, FieldType, GeneratedFieldItem, MailboxAccount } from './types';
import { generateStrongPassword } from './crypto';
import { mailTm } from './guerrillamail';

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function formatTemplate(template: string): string {
  return template.replace(/#/g, () => Math.floor(Math.random() * 10).toString());
}

function formatTemplateWithLetters(template: string): string {
  return template.replace(/#/g, () => Math.floor(Math.random() * 10).toString())
    .replace(/X/g, () => String.fromCharCode(65 + Math.floor(Math.random() * 26)));
}

const MONTH_NAMES_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const BANKS_BY_COUNTRY: Record<string, string[]> = {
  US: ['Bank of America', 'Chase', 'Wells Fargo', 'Citibank', 'Capital One'],
  GB: ['Barclays', 'HSBC UK', 'Lloyds Bank', 'NatWest', 'Santander UK'],
  IN: ['HDFC Bank', 'State Bank of India', 'ICICI Bank', 'Axis Bank', 'Kotak Mahindra'],
  DE: ['Deutsche Bank', 'Commerzbank', 'DZ Bank', 'KfW', 'N26'],
  FR: ['BNP Paribas', 'Crédit Agricole', 'Société Générale', 'BPCE'],
  CA: ['RBC Royal Bank', 'TD Canada Trust', 'Scotiabank', 'BMO Bank of Montreal'],
  AU: ['Commonwealth Bank', 'Westpac', 'ANZ', 'National Australia Bank'],
  JP: ['Mitsubishi UFJ', 'Sumitomo Mitsui', 'Mizuho Bank', 'Japan Post Bank'],
};

export interface GeneratedIdentityContext {
  countryCode: string;
  gender: 'male' | 'female';
  title: string;
  firstName: string;
  middleName: string;
  middleInitial: string;
  lastName: string;
  fullName: string;
  username: string;
  location: {
    city: string;
    state: string;
    zip: string;
  };
  street: string;
  streetNumber: number;
  addressLine1: string;
  addressLine2: string;
  phone: string;
  phoneHome: string;
  phoneWork: string;
  phoneMobile: string;
  fax: string;
  company: string;
  jobTitle: string;
  website: string;
  cardType: string;
  cardNumber: string;
  cardCvv: string;
  cardExpMonth: string;
  cardExpYear: string;
  bankName: string;
  cardPhone: string;
  ssn: string;
  driverLicense: string;
  birthPlace: string;
  dob: string;
  dobMonth: string;
  dobMonthName: string;
  dobDay: string;
  dobYear: string;
  age: string;
  income: string;
  comments: string;
  password: string;
  emailAddress?: string;
  mailboxPassword?: string;
  mailboxAccount?: MailboxAccount;
}

const JOB_TITLES = [
  'Software Engineer',
  'Product Manager',
  'Marketing Director',
  'Financial Analyst',
  'Design Lead',
  'Systems Architect',
  'Operations Manager',
  'Research Specialist',
];

const CUSTOM_MESSAGES = [
  'Please proceed with the account verification and confirm via email.',
  'Looking forward to collaborating with your platform.',
  'Please contact me directly if further verification is required.',
  'Requesting standard registration with notifications enabled.',
];

/**
 * Generate a complete, coherent localized identity
 */
export function createIdentityContext(
  countryCode: string = 'US',
  pregeneratedPassword?: string
): GeneratedIdentityContext {
  const locale: CountryLocale = COUNTRIES[countryCode] || COUNTRIES.US;
  const gender: 'male' | 'female' = Math.random() > 0.5 ? 'male' : 'female';
  const title = gender === 'male' ? 'Mr.' : pickRandom(['Ms.', 'Mrs.']);
  const firstName = pickRandom(locale.firstNames[gender]);
  const middleInitialLetter = String.fromCharCode(65 + Math.floor(Math.random() * 26));
  const middleInitial = `${middleInitialLetter}.`;
  const middleName = pickRandom(locale.firstNames[gender]);
  const lastName = pickRandom(locale.lastNames);
  const fullName = middleInitial ? `${firstName} ${middleInitial} ${lastName}` : `${firstName} ${lastName}`;
  
  const numSuffix = randomInt(10, 99);
  const username = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${numSuffix}`;
  const location = pickRandom(locale.locations);
  const street = pickRandom(locale.streets);
  const streetNumber = randomInt(12, 899);
  
  const addressLine1 =
    locale.streetNumberPlacement === 'after'
      ? `${street} ${streetNumber}`
      : `${streetNumber} ${street}`;
  
  const addressLine2 = `Apt ${randomInt(10, 99)}`;
  const phone = formatTemplate(locale.phoneFormat);
  const phoneHome = formatTemplate(locale.phoneFormat);
  const phoneWork = formatTemplate(locale.phoneFormat);
  const phoneMobile = formatTemplate(locale.phoneFormat);
  const fax = formatTemplate(locale.phoneFormat);
  const company = pickRandom(locale.companies);
  const jobTitle = pickRandom(JOB_TITLES);
  const website = `https://${username}.dev`;

  // Synthetic test card details
  const cardType = pickRandom(['Visa', 'MasterCard']);
  const cardNumber = formatTemplate('4532 #### #### ####');
  const cardCvv = String(randomInt(100, 999));
  const cardExpMonth = String(randomInt(1, 12)).padStart(2, '0');
  const cardExpYear = String(new Date().getFullYear() + randomInt(2, 5));
  const bankList = BANKS_BY_COUNTRY[locale.code] || BANKS_BY_COUNTRY.US;
  const bankName = pickRandom(bankList);
  const cardPhone = locale.cardPhoneFormat ? formatTemplate(locale.cardPhoneFormat) : '1-800-' + formatTemplate('###-####');

  // Date of birth: 1980 - 2002
  const birthYearNum = randomInt(1980, 2002);
  const birthMonthNum = randomInt(1, 12);
  const birthDayNum = randomInt(1, 28);
  const birthMonth = String(birthMonthNum).padStart(2, '0');
  const birthDay = String(birthDayNum).padStart(2, '0');
  const birthYear = String(birthYearNum);
  const dobMonthName = MONTH_NAMES_SHORT[birthMonthNum - 1];
  const dob = `${birthYear}-${birthMonth}-${birthDay}`;
  const currentYear = new Date().getFullYear();
  const age = String(currentYear - birthYearNum);
  const birthPlace = location.city;

  // Identity documents
  const ssn = locale.idFormat ? formatTemplateWithLetters(locale.idFormat) : formatTemplate('###-##-####');
  const driverLicense = locale.driverLicenseFormat ? formatTemplateWithLetters(locale.driverLicenseFormat) : `${String.fromCharCode(65 + Math.floor(Math.random() * 26))}${formatTemplate('#######')}`;
  const income = locale.incomeFormat ? formatTemplate(locale.incomeFormat) : `$${randomInt(55, 140)},000`;
  const comments = pickRandom(CUSTOM_MESSAGES);

  const password = pregeneratedPassword || generateStrongPassword(16);

  return {
    countryCode: locale.code,
    gender,
    title,
    firstName,
    middleName,
    middleInitial,
    lastName,
    fullName,
    username,
    location,
    street,
    streetNumber,
    addressLine1,
    addressLine2,
    phone,
    phoneHome,
    phoneWork,
    phoneMobile,
    fax,
    company,
    jobTitle,
    website,
    cardType,
    cardNumber,
    cardCvv,
    cardExpMonth,
    cardExpYear,
    bankName,
    cardPhone,
    ssn,
    driverLicense,
    birthPlace,
    dob,
    dobMonth: birthMonth,
    dobMonthName,
    dobDay: birthDay,
    dobYear: birthYear,
    age,
    income,
    comments,
    password,
    emailAddress: `${username}@sharklasers.com`,
    mailboxPassword: 'PhakePass123!A',
  };
}

/**
 * Provision a genuine, real, authenticated temp-mail inbox for this identity
 */
export async function provisionMailboxForIdentity(
  context: GeneratedIdentityContext
): Promise<MailboxAccount> {
  try {
    const mb = await mailTm.createAccount(context.username || `user_${Math.random().toString(36).slice(2, 8)}`);
    mb.nameTag = context.firstName || context.fullName;
    context.emailAddress = mb.address;
    context.mailboxPassword = mb.password;
    context.mailboxAccount = mb;
    return mb;
  } catch (err) {
    console.warn('Mailbox provisioning fallback', err);
    const fallbackAddress = `${context.username || 'phk_' + Math.random().toString(36).slice(2, 8)}@sharklasers.com`;
    const fallbackMb: MailboxAccount = {
      id: `mb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      address: fallbackAddress,
      password: 'PhakePass123!A',
      createdAt: Date.now(),
      unreadCount: 0,
      nameTag: context.firstName || context.fullName,
    };
    context.emailAddress = fallbackAddress;
    context.mailboxPassword = 'PhakePass123!A';
    context.mailboxAccount = fallbackMb;
    return fallbackMb;
  }
}

/**
 * Map detected fields to localized generated values
 */
export function generateFieldValues(
  fields: DetectedField[],
  context: GeneratedIdentityContext
): GeneratedFieldItem[] {
  const computedFullName = [context.firstName, context.middleInitial, context.lastName]
    .filter((p) => p && p.trim().length > 0)
    .join(' ')
    .trim();

  return fields.map((f) => {
    let val = '';
    switch (f.type) {
      case 'title':
        val = context.title;
        break;
      case 'first_name':
        val = context.firstName;
        break;
      case 'middle_name':
      case 'middle_initial':
        val = context.middleInitial;
        break;
      case 'last_name':
        val = context.lastName;
        break;
      case 'full_name':
        val = computedFullName || context.fullName;
        break;
      case 'email':
        val = context.emailAddress || `${context.username}@sharklasers.com`;
        break;
      case 'password':
      case 'confirm_password':
        val = context.password;
        break;
      case 'username':
        val = context.username;
        break;
      case 'phone':
        val = context.phone;
        break;
      case 'phone_mobile':
        val = context.phoneMobile;
        break;
      case 'phone_work':
        val = context.phoneWork;
        break;
      case 'phone_home':
        val = context.phoneHome;
        break;
      case 'fax':
        val = context.fax;
        break;
      case 'address_line1':
        val = context.addressLine1;
        break;
      case 'address_line2':
        val = context.addressLine2;
        break;
      case 'city':
        val = context.location.city;
        break;
      case 'state':
        val = context.location.state;
        break;
      case 'zip':
        val = context.location.zip;
        break;
      case 'country':
        val = COUNTRIES[context.countryCode]?.name || 'United States';
        break;
      case 'company':
        val = context.company;
        break;
      case 'job_title':
        val = context.jobTitle;
        break;
      case 'website':
        val = context.website;
        break;
      case 'card_type':
        val = context.cardType;
        break;
      case 'card_number':
        val = context.cardNumber;
        break;
      case 'card_cvv':
        val = context.cardCvv;
        break;
      case 'card_exp_month':
        val = context.cardExpMonth;
        break;
      case 'card_exp_year':
        val = context.cardExpYear;
        break;
      case 'bank_name':
        val = context.bankName;
        break;
      case 'card_phone':
        val = context.cardPhone;
        break;
      case 'ssn':
        val = context.ssn;
        break;
      case 'driver_license':
        val = context.driverLicense;
        break;
      case 'birth_place':
        val = context.birthPlace;
        break;
      case 'dob':
        val = context.dob;
        break;
      case 'dob_month':
        val = context.dobMonthName;
        break;
      case 'dob_day':
        val = context.dobDay;
        break;
      case 'dob_year':
        val = context.dobYear;
        break;
      case 'age':
        val = context.age;
        break;
      case 'income':
        val = context.income;
        break;
      case 'comments':
        val = context.comments;
        break;
      case 'gender':
        val = context.gender === 'male' ? 'Male' : 'Female';
        break;
      default:
        val = context.fullName;
    }

    return {
      id: f.id,
      type: f.type,
      label: f.label,
      value: val,
      selector: f.selector,
    };
  });
}

/**
 * Get standard comprehensive identity fields for constant layout display
 */
export function getDefaultIdentityFields(
  context: GeneratedIdentityContext
): GeneratedFieldItem[] {
  const countryName = COUNTRIES[context.countryCode]?.name || 'United States';
  const computedFullName = [context.firstName, context.middleInitial, context.lastName]
    .filter((p) => p && p.trim().length > 0)
    .join(' ')
    .trim();

  return [
    { id: 'f_title', selector: '', type: 'title', label: 'Title', value: context.title },
    { id: 'f_fname', selector: '', type: 'first_name', label: 'First Name', value: context.firstName },
    { id: 'f_mname', selector: '', type: 'middle_name', label: 'Middle Initial', value: context.middleInitial },
    { id: 'f_lname', selector: '', type: 'last_name', label: 'Last Name', value: context.lastName },
    { id: 'f_fullname', selector: '', type: 'full_name', label: 'Full Name', value: computedFullName || context.fullName },
    { id: 'f_user', selector: '', type: 'username', label: 'Username', value: context.username },
    {
      id: 'f_email',
      selector: '',
      type: 'email',
      label: 'Email',
      value: context.emailAddress || `${context.username}@sharklasers.com`,
    },
    { id: 'f_pass', selector: '', type: 'password', label: 'Password', value: context.password },
    { id: 'f_phone', selector: '', type: 'phone', label: 'Phone', value: context.phone },
    { id: 'f_addr1', selector: '', type: 'address_line1', label: 'Address', value: context.addressLine1 },
    { id: 'f_city', selector: '', type: 'city', label: 'City', value: context.location.city },
    { id: 'f_state', selector: '', type: 'state', label: 'State / Region', value: context.location.state },
    { id: 'f_zip', selector: '', type: 'zip', label: 'Zip / Postal', value: context.location.zip },
    { id: 'f_country', selector: '', type: 'country', label: 'Country', value: countryName },
    { id: 'f_company', selector: '', type: 'company', label: 'Company', value: context.company },
    { id: 'f_job', selector: '', type: 'job_title', label: 'Job Title', value: context.jobTitle },
    { id: 'f_web', selector: '', type: 'website', label: 'Website', value: context.website },
  ];
}
