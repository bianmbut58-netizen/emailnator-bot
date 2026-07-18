#!/usr/bin/env python3
"""
Emailnator bridge — called by Node.js bot via child_process.
Uses cloudscraper to bypass Cloudflare.
"""
import cloudscraper, json, sys
from urllib.parse import unquote

BASE = 'https://www.emailnator.com'

def main():
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'No command'}))
        sys.exit(1)

    cmd = sys.argv[1]
    scraper = cloudscraper.create_scraper()

    # GET homepage to get cookies + XSRF token
    r = scraper.get(BASE)
    if r.status_code != 200:
        print(json.dumps({'error': f'Failed to load page: {r.status_code}'}))
        sys.exit(1)

    xsrf = ''
    for c in scraper.cookies:
        if c.name == 'XSRF-TOKEN':
            xsrf = unquote(c.value)
            break

    if not xsrf:
        print(json.dumps({'error': 'Could not get XSRF token'}))
        sys.exit(1)

    headers = {
        'X-XSRF-TOKEN': xsrf,
        'X-Requested-With': 'XMLHttpRequest',
        'Content-Type': 'application/json',
    }

    if cmd == 'create':
        headers['Referer'] = f'{BASE}/'
        r2 = scraper.post(
            f'{BASE}/generate-email',
            json={'email': ['plusGmail', 'dotGmail']},
            headers=headers,
        )
        if r2.status_code != 200:
            print(json.dumps({'error': f'Create failed: {r2.status_code}'}))
            sys.exit(1)
        print(json.dumps(r2.json()))

    elif cmd == 'inbox':
        if len(sys.argv) < 3:
            print(json.dumps({'error': 'Email required'}))
            sys.exit(1)
        email = sys.argv[2]
        headers['Referer'] = f'{BASE}/mailbox/'
        r2 = scraper.post(
            f'{BASE}/message-list',
            json={'email': email},
            headers=headers,
        )
        if r2.status_code != 200:
            print(json.dumps({'error': f'Inbox failed: {r2.status_code}'}))
            sys.exit(1)
        print(json.dumps(r2.json()))

    elif cmd == 'read':
        if len(sys.argv) < 4:
            print(json.dumps({'error': 'Email and messageID required'}))
            sys.exit(1)
        email = sys.argv[2]
        msg_id = sys.argv[3]
        headers['Referer'] = f'{BASE}/mailbox/'
        r2 = scraper.post(
            f'{BASE}/message-list',
            json={'email': email, 'messageID': msg_id},
            headers=headers,
        )
        if r2.status_code != 200:
            print(json.dumps({'error': f'Read failed: {r2.status_code}'}))
            sys.exit(1)
        print(r2.text)

    else:
        print(json.dumps({'error': f'Unknown command: {cmd}'}))
        sys.exit(1)

if __name__ == '__main__':
    main()
