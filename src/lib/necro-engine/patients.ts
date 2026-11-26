import { NecroPatient } from "./types";

export const PRESET_PATIENTS: NecroPatient[] = [
  {
    id: "patient_py2_archiver",
    name: "Archivus Mortis (CLI Archiver)",
    repoSlug: "github.com/archive-vault/dead-url-crawler-2014",
    deceasedYear: 2014,
    cemeteryLocation: "Grave #27 — Python 2 Graveyard",
    language: "python",
    tombstoneInscription: "Here lies Archivus. Killed by Python 3.0 when print statements required parentheses and urllib2 dissolved into the ether.",
    deadCode: `#!/usr/bin/env python2
# Archivus Mortis - Python 2.7 URL Archiver (Died Oct 2014)
import urllib2
import sys
import time

def fetch_archive(target_url, retries=3):
    print "Exhuming URL: %s" % target_url
    headers = {"User-Agent": "Archivus/1.0 (Dead-Bot)"}
    
    for attempt in xrange(1, retries + 1):
        try:
            req = urllib2.Request(target_url, headers=headers)
            response = urllib2.urlopen(req, timeout=5)
            content = response.read()
            print "Retrieved %d bytes successfully on attempt %d" % (len(content), attempt)
            return content
        except urllib2.HTTPError, e:
            print "HTTP Error %d: %s" % (e.code, e.reason)
            time.sleep(1)
        except urllib2.URLError, e:
            print "Fatal connection rot: %s" % e.reason
            return None
    return None

def analyze_metadata(headers_dict):
    sanitized = {}
    for k, v in headers_dict.iteritems():
        sanitized[k.lower()] = v.strip()
    return sanitized

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print "Usage: python archiver.py <url>"
        sys.exit(1)
    fetch_archive(sys.argv[1])`,
    expectedModernCode: `#!/usr/bin/env python3
# Archivus Mortis - Resurrected to Modern Python 3.12 (via NecroCode & Kiro)
import sys
import time
import urllib.request
import urllib.error
from typing import Optional, Dict

def fetch_archive(target_url: str, retries: int = 3) -> Optional[bytes]:
    print(f"Exhuming URL: {target_url}")
    headers = {"User-Agent": "Archivus/2.0 (Resurrected-Modern-Bot)"}
    
    for attempt in range(1, retries + 1):
        try:
            req = urllib.request.Request(target_url, headers=headers)
            with urllib.request.urlopen(req, timeout=5) as response:
                content = response.read()
                print(f"Retrieved {len(content)} bytes successfully on attempt {attempt}")
                return content
        except urllib.error.HTTPError as e:
            print(f"HTTP Error {e.code}: {e.reason}")
            time.sleep(1)
        except urllib.error.URLError as e:
            print(f"Fatal connection rot: {e.reason}")
            return None
    return None

def analyze_metadata(headers_dict: Dict[str, str]) -> Dict[str, str]:
    sanitized = {}
    for k, v in headers_dict.items():
        sanitized[k.lower()] = v.strip()
    return sanitized

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python archiver.py <url>")
        sys.exit(1)
    fetch_archive(sys.argv[1])`,
    legacyDependencies: ["urllib2", "python==2.7.6", "distutils"],
    modernDependencies: ["python>=3.12", "urllib.request", "typing"],
    testSuites: [
      {
        name: "test_syntax_compilation",
        description: "Compile source code with modern Python 3.12 AST compiler",
        legacyResult: "SYNTAX_ERROR",
        resurrectedResult: "PASS",
        executionMs: 14,
      },
      {
        name: "test_urllib_import_resolution",
        description: "Verify standard library network modules resolve cleanly without missing urllib2",
        legacyResult: "IMPORT_ERROR",
        resurrectedResult: "PASS",
        executionMs: 8,
      },
      {
        name: "test_metadata_dictionary_iteration",
        description: "Verify dictionary iteration uses modern .items() without deprecated .iteritems()",
        legacyResult: "FAIL",
        resurrectedResult: "PASS",
        executionMs: 6,
      },
    ],
  },
  {
    id: "patient_node_webhook",
    name: "Webhook Specter (Node 6 Dispatcher)",
    repoSlug: "github.com/ghost-services/slack-webhook-2016",
    deceasedYear: 2016,
    cemeteryLocation: "Grave #44 — Deprecated NPM Sepulcher",
    language: "javascript",
    tombstoneInscription: "Killed by the demise of the 'request' npm package, insecure Buffer allocations, and unhandled promise rejections.",
    deadCode: `// Webhook Specter - Node.js 6.x CommonJS Dispatcher (Died Nov 2016)
var request = require('request');
var crypto = require('crypto');

function dispatchNotification(webhookUrl, message, callback) {
    if (!webhookUrl) {
        return callback(new Error("Missing webhook URL"));
    }
    
    // Insecure deprecated Node 6 Buffer constructor (CVE vulnerability)
    var payloadBuffer = new Buffer(JSON.stringify({ text: message }));
    
    var options = {
        url: webhookUrl,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': payloadBuffer.length
        },
        body: payloadBuffer
    };
    
    request(options, function (error, response, body) {
        if (error) {
            console.log("Error dispatching webhook: " + error.message);
            return callback(error);
        }
        if (response.statusCode >= 400) {
            return callback(new Error("Server returned status: " + response.statusCode));
        }
        console.log("Notification dispatched successfully to: " + webhookUrl);
        callback(null, { status: 'sent', code: response.statusCode });
    });
}

module.exports = {
    dispatchNotification: dispatchNotification
};`,
    expectedModernCode: `// Webhook Specter - Resurrected to Modern Node.js 20+ ESM (via NecroCode & Kiro)
import crypto from 'node:crypto';

export async function dispatchNotification(webhookUrl, message) {
    if (!webhookUrl) {
        throw new Error("Missing webhook URL");
    }

    // Modern memory-safe Buffer allocation (patched CVE)
    const payloadBuffer = Buffer.from(JSON.stringify({ text: message }), 'utf-8');

    const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': String(payloadBuffer.length)
        },
        body: payloadBuffer
    });

    if (!response.ok) {
        throw new Error(\`Server returned status: \${response.status}\`);
    }

    console.log(\`Notification dispatched successfully to: \${webhookUrl}\`);
    return { status: 'sent', code: response.status };
}`,
    legacyDependencies: ["request@2.79.0 (DEPRECATED)", "node<=6.9.1"],
    modernDependencies: ["node>=20.0.0", "native-fetch", "ESM modules"],
    testSuites: [
      {
        name: "test_cve_buffer_security_scan",
        description: "Audit for CVE-2018-7166 (unsafe Buffer constructor allocation)",
        legacyResult: "FAIL",
        resurrectedResult: "PASS",
        executionMs: 12,
      },
      {
        name: "test_deprecated_request_package_elimination",
        description: "Ensure dead 'request' dependency is replaced with native Node 20+ fetch API",
        legacyResult: "IMPORT_ERROR",
        resurrectedResult: "PASS",
        executionMs: 9,
      },
      {
        name: "test_promise_async_await_flow",
        description: "Verify clean Promise resolution replacing legacy callback pyramid",
        legacyResult: "FAIL",
        resurrectedResult: "PASS",
        executionMs: 7,
      },
    ],
  },
];
