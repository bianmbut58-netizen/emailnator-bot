const axios = require('axios');
const { CookieJar } = require('tough-cookie');
const { wrapper } = require('axios-cookiejar-support');
const cheerio = require('cheerio');
const config = require('./config');

/**
 * Emailnator — Generate disposable email & check inbox
 */
class Emailnator {
  constructor(options = {}) {
    this.jar = new CookieJar();
    this.client = wrapper(axios.create({
      jar: this.jar,
      baseURL: config.emailnator.baseURL,
      timeout: options.timeout || config.emailnator.timeout,
      headers: {
        'User-Agent': options.userAgent || config.emailnator.userAgent,
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        'sec-ch-ua-platform': '"Android"',
        'x-requested-with': 'XMLHttpRequest',
        'origin': config.emailnator.baseURL,
        'sec-fetch-site': 'same-origin',
        'sec-fetch-mode': 'cors',
        'sec-fetch-dest': 'empty',
        'accept-language': 'id,ms;q=0.9,en;q=0.8',
      },
    }));
  }

  /**
   * Extract XSRF-TOKEN from cookies
   */
  async getToken() {
    const cookies = await this.jar.getCookies(config.emailnator.baseURL);
    const xsrf = cookies.find((c) => c.key === 'XSRF-TOKEN');
    return xsrf?.value ? decodeURIComponent(xsrf.value) : '';
  }

  /**
   * Generate a new disposable email
   * @returns {Promise<{email: string}>}
   */
  async create() {
    await this.client.get('/');
    const xsrfToken = await this.getToken();
    if (!xsrfToken) throw new Error('Failed to get XSRF token');

    const { data } = await this.client.post(
      '/generate-email',
      { email: ['plusGmail', 'dotGmail'] },
      { headers: { 'x-xsrf-token': xsrfToken, referer: `${config.emailnator.baseURL}/` } }
    );

    return { email: data.email[0] };
  }

  /**
   * Fetch inbox / message list
   * @param {string} email
   * @returns {Promise<{totalEmails: number, emails: Array}>}
   */
  async getInbox(email) {
    if (!email) throw new Error('Email is required');

    await this.client.get('/');
    const xsrfToken = await this.getToken();
    if (!xsrfToken) throw new Error('XSRF token not found');

    const { data } = await this.client.post(
      '/message-list',
      { email },
      { headers: { 'x-xsrf-token': xsrfToken, referer: `${config.emailnator.baseURL}/mailbox/` } }
    );

    const messages = data.messageData || [];
    const emails = [];

    for (const m of messages) {
      if (m.messageID === 'ADSVPN') continue;

      try {
        const detail = await this.getMessage(email, m.messageID, xsrfToken);
        emails.push(detail);
      } catch {
        // skip failed detail fetches
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
   * @param {string} email
   * @param {string} messageID
   * @param {string} [xsrfToken]
   * @returns {Promise<{id, from, subject, text, time}>}
   */
  async getMessage(email, messageID, xsrfToken) {
    if (!xsrfToken) {
      await this.client.get('/');
      xsrfToken = await this.getToken();
    }

    const { data } = await this.client.post(
      '/message-list',
      { email, messageID },
      { headers: { 'x-xsrf-token': xsrfToken, referer: `${config.emailnator.baseURL}/mailbox/` } }
    );

    // Parse HTML response
    const $ = cheerio.load(data);
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
      from: data.from || '?',
      subject: data.subject || '(no subject)',
      text: content || '(empty)',
      time: data.time || '',
    };
  }
}

module.exports = Emailnator;
