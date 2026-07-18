const { execSync } = require('child_process');
const path = require('path');
const cheerio = require('cheerio');
const config = require('./config');

const PY_SCRIPT = path.join(__dirname, 'emailnator.py');

/**
 * Call Python cloudscraper bridge and return parsed result
 */
function pyCall(...args) {
  const cmd = `python3 "${PY_SCRIPT}" ${args.map(a => `"${String(a).replace(/"/g, '\\"')}"`).join(' ')}`;
  try {
    const stdout = execSync(cmd, { timeout: config.emailnator.timeout, encoding: 'utf-8' });
    return JSON.parse(stdout);
  } catch (err) {
    // Try to parse stderr for JSON
    if (err.stdout) {
      try {
        return JSON.parse(err.stdout);
      } catch {}
    }
    throw new Error(err.stderr?.trim() || err.message);
  }
}

/**
 * Emailnator — Generate disposable email & check inbox
 * Uses Python cloudscraper under the hood to bypass Cloudflare.
 */
class Emailnator {
  /**
   * Generate a new disposable email
   * @returns {{email: string}}
   */
  async create() {
    const result = pyCall('create');
    if (result.error) throw new Error(result.error);
    return { email: result.email[0] };
  }

  /**
   * Fetch inbox / message list
   * @param {string} email
   * @returns {{totalEmails: number, emails: Array}}
   */
  async getInbox(email) {
    if (!email) throw new Error('Email is required');
    const result = pyCall('inbox', email);
    if (result.error) throw new Error(result.error);

    const messages = result.messageData || [];
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
   * @param {string} email
   * @param {string} messageID
   * @returns {{id, from, subject, text, time}}
   */
  async getMessage(email, messageID) {
    const body = pyCall('read', email, messageID);
    if (body.error) throw new Error(body.error);

    // Try JSON first
    let from = '?', subject = '(no subject)', time = '';
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
}

module.exports = Emailnator;
