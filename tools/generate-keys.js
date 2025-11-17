#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { generateKeyPairSync } = require('crypto');

function main() {
  const dir = path.join(__dirname, '..', 'keys');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs1', format: 'pem' }
  });
  fs.writeFileSync(path.join(dir, 'private.pem'), privateKey, 'utf8');
  fs.writeFileSync(path.join(dir, 'public.pem'), publicKey, 'utf8');
  process.stdout.write('OK\n');
}

main();

