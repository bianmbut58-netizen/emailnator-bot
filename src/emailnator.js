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

  let stdout;
  try {
    stdout = execSync(cmd, { timeout: config.emailnator.timeout, encoding: 'utf-8' });
  } catch (err) {
    // Python exited non-zero — it prints a JSON error to stdout
    try {
      return JSON.parse(err.stdout);
    } catch {}
    throw new Error(err.stderr?.trim() || err.message);
  }

  // `create`/`inbox` return JSON, but `read` returns raw message HTML.
  // Only require JSON when the output actually is JSON.
  try {
    return JSON.parse(stdout);
  } catch {
    return stdout;
  }
}

/**
 * Collapse whitespace and reject suspiciously long values
 * (e.g. wrapper elements that matched a loose selector).
 */
function sanitize(v, maxLen = 250) {
  const s = String(v || '').replace(/\s+/g, ' ').trim();
  return s.length > maxLen ? '' : s;
}

/**
 * Text of the first element matching any selector.
 */
function firstText($, selectors) {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const t = sanitize(el.text());
      if (t) return t;
    }
  }
  return '';
}

/**
 * Attribute of the first element matching any selector.
 */
function firstAttr($, selectors, attr) {
  for (const sel of selectors) {
    const el = $(sel).first();
    if (el.length) {
      const v = sanitize(el.attr(attr));
      if (v) return v;
    }
  }
  return '';
}

/**
 * Fallback: extract a raw email header field ("From:", "Subject:", "Date:")
 * from the header zone at the top of the rendered message.
 */
function headerField($, label) {
  const zone = $('body').text().slice(0, 1000);
  const anchored = zone.match(new RegExp(`(?:^|[\\n\\r;])\\s*${label}\\s*:([^\\n\\r]{1,200})`, 'i'));
  if (anchored) return sanitize(anchored[1], 200);
  const loose = zone.match(new RegExp(`${label}\\s*:([^\\n\\r]{1,200})`, 'i'));
  return loose ? sanitize(loose[1], 200) : '';
}

/**
 * Best-effort extraction of the message subject from the rendered HTML.
 */
function extractSubject($) {
  let v = firstText($, ['#subject-header', '.subject-header', '.subject', '.email-subject', '.message-subject']);
  if (v) return v;
  v = firstAttr($, ['meta[name="subject"]', 'meta[property="og:title"]'], 'content');
  if (v) return v;
  v = headerField($, 'Subject');
  if (v) return v;
  return firstText($, ['h1', 'h2']);
}

/**
 * Best-effort extraction of the sender from the rendered HTML.
 */
function extractFrom($) {
  const mailto = $('a[href^="mailto:"]').first();
  if (mailto.length) {
    const label = sanitize(mailto.text(), 150);
    if (label) return label;
    const href = (mailto.attr('href') || '').replace(/^mailto:/i, '').split('?')[0].trim();
    if (href) return href;
  }
  let v = firstText($, ['#from', '.from', '.from-name', '.sender', '.sender-name', '.email-from']);
  if (v) return v;
  v = firstAttr($, ['meta[name="from"]', 'meta[name="sender"]'], 'content');
  if (v) return v;
  v = headerField($, 'From');
  if (v) return v;
  // Last resort: first email address in the header zone
  const m = $('body').text().slice(0, 500).match(/[\w.+-]+@[\w-]+\.[A-Za-z]{2,}/);
  return m ? m[0] : '';
}

/**
 * Best-effort extraction of the message date/time from the rendered HTML.
 */
function extractTime($) {
  const timeEl = $('time[datetime]').first();
  if (timeEl.length) {
    const t = sanitize(timeEl.attr('datetime'), 100);
    if (t) return t;
  }
  let v = firstText($, ['.time', '.date', '.email-date', '.message-date']);
  if (v) return v;
  v = firstAttr($, ['meta[property="article:published_time"]', 'meta[name="date"]', 'meta[name="time"]'], 'content');
  if (v) return v;
  return headerField($, 'Date');
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
    const email = Array.isArray(result.email) ? result.email[0] : null;
    if (!email) throw new Error('Unexpected response from Emailnator (no email returned)');
    return { email };
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

    // Some responses are JSON metadata ({from, subject, time, message})
    if (typeof body === 'object' && body !== null) {
      return {
        id: messageID,
        from: body.from || '?',
        subject: body.subject || '(no subject)',
        text: body.message || body.text || body.body || '(empty)',
        time: body.time || '',
      };
    }

    const $ = cheerio.load(body);

    const from = extractFrom($);
    const subject = extractSubject($);
    const time = extractTime($);

    // Parse HTML content
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
      from: from || '?',
      subject: subject || '(no subject)',
      text: content || '(empty)',
      time,
    };
  }
}

module.exports = Emailnator;
