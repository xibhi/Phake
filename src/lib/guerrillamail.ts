import {
  MailboxAccount,
  MailMessageDetail,
  MailMessageSummary,
} from './types';

export const GUERRILLA_BASE = 'https://api.guerrillamail.com/ajax.php';

export interface TempMailError {
  status: number;
  message: string;
}

export type MailTmError = TempMailError;

const GUERRILLA_DOMAINS = [
  'sharklasers.com',
  'guerrillamailblock.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'guerrillamail.org',
  'pokemail.net',
  'spam4.me',
];

class GuerrillaMailClient {
  private sidTokens: Map<string, string> = new Map();

  private async request<T>(
    url: string,
    options: RequestInit = {},
    token?: string
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    // Proxy via chrome.runtime background worker to bypass page CORS/CSP restrictions
    if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
      try {
        const res: any = await new Promise((resolve) => {
          chrome.runtime.sendMessage(
            {
              type: 'API_PROXY_REQUEST',
              payload: { url, options: { ...options, headers } },
            },
            (response) => {
              if (chrome.runtime?.lastError) {
                resolve({ fallbackDirect: true });
              } else {
                resolve(response);
              }
            }
          );
        });

        if (res && !res.fallbackDirect) {
          if (!res.success) {
            throw {
              status: 0,
              message: res.error || 'Network request failed',
            } as TempMailError;
          }

          if (res.status === 204) {
            return {} as T;
          }

          if (!res.ok) {
            const errorJson = typeof res.data === 'object' ? res.data : {};
            const errorMessage =
              errorJson?.message ||
              `HTTP ${res.status}: ${res.statusText}`;
            throw {
              status: res.status,
              message: errorMessage,
            } as TempMailError;
          }

          return res.data as T;
        }
      } catch (e: any) {
        if (e.status) throw e;
      }
    }

    // Direct fetch fallback
    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (response.status === 204) {
        return {} as T;
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        try {
          const errorJson = await response.json();
          errorMessage = errorJson.message || errorMessage;
        } catch {}
        const err: TempMailError = {
          status: response.status,
          message: errorMessage,
        };
        throw err;
      }

      return (await response.json()) as T;
    } catch (e: any) {
      if (e.status) throw e;
      throw {
        status: 0,
        message: e.message || 'Network request failed (offline or blocked)',
      } as TempMailError;
    }
  }

  /**
   * Fetch active domains available for new accounts
   */
  async getDomains(): Promise<string[]> {
    return GUERRILLA_DOMAINS;
  }

  /**
   * Get or initialize a GuerrillaMail session token with retry logic
   */
  private async getGuerrillaSid(username?: string, retries = 2): Promise<{ sid: string; address: string }> {
    const key = username || 'default';
    let sid = this.sidTokens.get(key);
    let lastError: any = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        if (!sid) {
          const res = await this.request<{ sid_token: string; email_addr: string }>(
            `${GUERRILLA_BASE}?f=get_email_address`
          );
          sid = res.sid_token;
          this.sidTokens.set(key, sid);
        }

        if (username) {
          const cleanUser = username.toLowerCase().replace(/[^a-z0-9._-]/g, '');
          const setRes = await this.request<{ email_addr: string; sid_token: string }>(
            `${GUERRILLA_BASE}?f=set_email_user&email_user=${cleanUser}&lang=en&sid_token=${sid}`
          );
          if (setRes.sid_token) {
            sid = setRes.sid_token;
            this.sidTokens.set(key, sid);
          }
          return { sid, address: setRes.email_addr };
        }

        const addrRes = await this.request<{ email_addr: string }>(
          `${GUERRILLA_BASE}?f=get_email_address&sid_token=${sid}`
        );
        return { sid, address: addrRes.email_addr };
      } catch (err: any) {
        lastError = err;
        sid = undefined;
        this.sidTokens.delete(key);
        if (attempt < retries) {
          await new Promise((resolve) => setTimeout(resolve, 300 * (attempt + 1)));
        }
      }
    }

    throw lastError || new Error('Failed to initialize session with disposable email provider');
  }

  /**
   * Create a genuine random temp-mail account guaranteed to receive emails live
   */
  async createRandomAccount(): Promise<MailboxAccount> {
    const prefix = 'phk_' + Math.random().toString(36).substring(2, 10);
    return await this.createAccount(prefix, 'PhakePass123!A');
  }

  /**
   * Create a new temporary inbox account
   */
  async createAccount(addressOrPrefix: string, password: string = 'PhakePass123!A'): Promise<MailboxAccount> {
    const rawUser = addressOrPrefix.includes('@') ? addressOrPrefix.split('@')[0] : addressOrPrefix;
    const cleanUser = rawUser.toLowerCase().replace(/[^a-z0-9._-]/g, '');

    try {
      const { sid, address } = await this.getGuerrillaSid(cleanUser);
      return {
        id: `mb_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        address: address || `${cleanUser}@sharklasers.com`,
        password: password,
        token: sid,
        createdAt: Date.now(),
        unreadCount: 0,
      };
    } catch (err: any) {
      console.warn('GuerrillaMail initialization failed', err);
      throw new Error(
        err?.message || 'Unable to connect to disposable email service. Please check your connection and try again.'
      );
    }
  }

  /**
   * Ensure account has a valid token
   */
  async ensureToken(account: MailboxAccount): Promise<string> {
    const user = account.address.split('@')[0];
    if (account.token) {
      this.sidTokens.set(user, account.token);
      return account.token;
    }

    const { sid } = await this.getGuerrillaSid(user);
    account.token = sid;
    return sid;
  }

  /**
   * Fetch messages for an account with automatic token refresh
   */
  async getMessages(account: MailboxAccount): Promise<MailMessageSummary[]> {
    const user = account.address.split('@')[0];

    try {
      const { sid } = await this.getGuerrillaSid(user);
      const res = await this.request<{ list: any[]; count: string }>(
        `${GUERRILLA_BASE}?f=get_email_list&offset=0&sid_token=${sid}`
      );

      const list = res.list || [];
      return list.map((m: any) => ({
        id: String(m.mail_id),
        accountId: account.id,
        msgid: String(m.mail_id),
        from: {
          address: m.mail_from || 'unknown@sender.com',
          name: m.mail_from?.split('<')[0]?.trim() || m.mail_from || 'Sender',
        },
        to: [
          {
            address: account.address,
            name: user,
          },
        ],
        subject: m.mail_subject || '(No Subject)',
        intro: m.mail_excerpt || m.mail_body?.slice(0, 100) || '',
        seen: Boolean(m.mail_read === 1 || m.mail_read === '1'),
        isDeleted: false,
        hasAttachments: Boolean(m.att && Number(m.att) > 0),
        size: Number(m.size || 0),
        downloadUrl: '',
        createdAt: m.mail_timestamp
          ? new Date(Number(m.mail_timestamp) * 1000).toISOString()
          : new Date().toISOString(),
      }));
    } catch (err) {
      console.warn('Failed to fetch Guerrilla messages', err);
      return [];
    }
  }

  /**
   * Fetch full message content by ID
   */
  async getMessage(account: MailboxAccount, messageId: string): Promise<MailMessageDetail> {
    const user = account.address.split('@')[0];

    const { sid } = await this.getGuerrillaSid(user);
    const m: any = await this.request(
      `${GUERRILLA_BASE}?f=fetch_email&email_id=${messageId}&sid_token=${sid}`
    );

    const htmlBody = m.mail_body || '';

    return {
      id: String(m.mail_id || messageId),
      accountId: account.id,
      msgid: String(m.mail_id || messageId),
      from: {
        address: m.mail_from || 'sender@domain.com',
        name: m.mail_from?.split('<')[0]?.trim() || m.mail_from || 'Sender',
      },
      to: [{ address: account.address, name: user }],
      subject: m.mail_subject || '(No Subject)',
      intro: m.mail_excerpt || '',
      seen: true,
      isDeleted: false,
      hasAttachments: Boolean(m.att && Number(m.att) > 0),
      size: Number(m.size || 0),
      downloadUrl: '',
      createdAt: m.mail_timestamp
        ? new Date(Number(m.mail_timestamp) * 1000).toISOString()
        : new Date().toISOString(),
      text: htmlBody.replace(/<[^>]+>/g, ''),
      html: [htmlBody],
      attachments: [],
    };
  }

  /**
   * Delete a message
   */
  async deleteMessage(account: MailboxAccount, messageId: string): Promise<boolean> {
    const user = account.address.split('@')[0];
    try {
      const { sid } = await this.getGuerrillaSid(user);
      await this.request(`${GUERRILLA_BASE}?f=del_email&email_ids[]=${messageId}&sid_token=${sid}`);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete an account
   */
  async deleteAccount(_account: MailboxAccount): Promise<boolean> {
    return true;
  }
}

export const tempMail = new GuerrillaMailClient();
export const mailTm = tempMail;

