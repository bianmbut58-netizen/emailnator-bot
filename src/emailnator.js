const { chromium } = require('playwright');
const cheerio = require('cheerio');
const config = require('./config');

/**
 * Singleton browser instance — shared across all Emailnator calls
 */
let _browser = null;
let _context = null;
let _initPromise = null;

async function getContext() {
  if (_context) return _context;

  if (!_initPromise) {
    _initPromise = (async () => {
      _browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-blink-features=AutomationControlled'],
      });

      _context = await _browser.newContext({
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        viewport: { width: 1920, height: 1080 },
      });

      await _context.addInitScript(() => {
        // Hide automation from Cloudflare
        Object.defineProperty(navigator, 'webdriver', { get: () => false });
      });
    })();
  }

  await _initPromise;
  return _context;
}

/**
 * Navigate to homepage, pass Cloudflare, and return XSRF-TOKEN
 */
async function refreshSession() {
  const ctx = await getContext();
  const page = await ctx.newPage();

  try {
    await page.goto(config.emailnator.baseURL, {
      waitUntil: 'domcontentloaded',
      timeout: 15000,
    });

    // Wait for Cloudflare challenge to pass
    await page.waitForFunction(
      () => !document.title.includes('Just a moment'),
      { timeout: 25000 }
    );

    const cookies = await ctx.cookies();
    const xsrf = cookies.find((c) => c.name === 'XSRF-TOKEN');
    return xsrf ? decodeURIComponent(xsrf.value) : '';
  } finally {
    await page.close();
  }
}

/**
 * Emailnator — Generate disposable email & check inbox (Playwright-powered)
 */
class Emailnator {
  constructor() {
    this._xsrfToken = '';
  }

  /**
   * Ensure we have a valid XSRF session
   */
  async ensureSession() {
    if (!this._xsrfToken) {
      this._xsrfToken = await refreshSession();
    }
    return this._xsrfToken;
  }

  /**
   * POST JSON to an Emailnator endpoint using the browser context's API request
   */
  async apiPost(path, body, extraHeaders = {}) {
    const ctx = await getContext();
    const xsrfToken = await this.ensureSession();

    const res = await ctx.request.post(`${config.emailnator.baseURL}${path}`, {
      data: body,
      headers: {
        'x-xsrf-token': xsrfToken,
        referer: `${config.emailnator.baseURL}/`,
        'content-type': 'application/json',
        'x-requested-with': 'XMLHttpRequest',
        ...extraHeaders,
      },
    });

    // If 403, session expired — refresh and retry once
    if (res.status() === 403) {
      this._xsrfToken = await refreshSession();
      const retryRes = await ctx.request.post(`${config.emailnator.baseURL}${path}`, {
        data: body,
        headers: {
          'x-xsrf-token': this._xsrfToken,
          referer: `${config.emailnator.baseURL}/`,
          'content-type': 'application/json',
          'x-requested-with': 'XMLHttpRequest',
          ...extraHeaders,
        },
      });
      const retryData = await retryRes.json();
      return retryData;
    }

    const data = await res.json();
    return data;
  }

  /**
   * Generate a new disposable email
   */
  async create() {
    const data = await this.apiPost('/generate-email', {
      email: ['plusGmail', 'dotGmail'],
    });
    return { email: data.email[0] };
  }

  /**
   * Fetch inbox / message list
   */
  async getInbox(email) {
    if (!email) throw new Error('Email is required');

    const data = await this.apiPost('/message-list', { email });

    const messages = data.messageData || [];
    const emails = [];

    for (const m of messages) {
      if (m.messageID === 'ADSVPN') continue;

      try {
        const detail = await this.getMessage(email, m.messageID);
        emails.push(detail);
      } catch {
        emails.push({
          id: m.messageID,
          from: m.from,
          subject: m.subject,
          text: '(gagal membaca konten)',
          time: m.time,
        });
      }
    }

    return { totalEmails: emails.length, emails };
  }

  /**
   * Fetch single message detail by messageID
   */
  async getMessage(email, messageID) {
    await this.ensureSession();

    const ctx = await getContext();
    const res = await ctx.request.post(`${config.emailnator.baseURL}/message-list`, {
      data: { email, messageID },
      headers: {
        'x-xsrf-token': this._xsrfToken,
        referer: `${config.emailnator.baseURL}/mailbox/`,
        'content-type': 'application/json',
        'x-requested-with': 'XMLHttpRequest',
      },
    });

    const body = await res.text();

    // Try JSON first
    let from = '?',
      subject = '(no subject)',
      time = '';
    try {
      const json = JSON.parse(body);
      from = json.from || '?';
      subject = json.subject || '(no subject)';
      time = json.time || '';
    } catch {
      // it's HTML
    }

    // Parse HTML content
    const $ = cheerio.load(body);
    $('style, script, img, #subject-header').remove();
    $('p, div, br, hr').each(function () {
      $(this).after('\n');
    });

    const content = $('body')
      .text()
      .replace(/\u200B/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n\s*\n\s*\n+/g, '\n\n')
      .trim();

    return {
      id: messageID,
      from,
      subject,
      text: content || '(empty)',
      time,
    };
  }

  /**
   * Clean up browser resources (call once when shutting down)
   */
  static async shutdown() {
    if (_browser) {
      await _browser.close();
      _browser = null;
      _context = null;
      _initPromise = null;
    }
  }
}

module.exports = Emailnator;
