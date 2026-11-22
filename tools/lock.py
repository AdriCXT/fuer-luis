#!/usr/bin/env python3
"""Verschlüsselt die echte Seite (index.src.html) in die öffentliche index.html.

  python3 lock.py encrypt <quelle.html> <shell.html> <ziel/index.html> <geheimwort>
  python3 lock.py decrypt <index.html> <geheimwort> > quelle.html

AES-256-GCM, Schlüssel = PBKDF2-SHA256(geheimwort.lower(), salt, ITER).
"""
import base64, os, re, sys
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ITER = 600_000

def key(word, salt, it=ITER):
    return PBKDF2HMAC(hashes.SHA256(), 32, salt, it).derive(word.strip().lower().encode())

def encrypt(src, shell, out, word):
    pt = open(src, "rb").read()
    # fester Salt: gespeicherte Schlüssel auf den Geräten bleiben nach Updates gültig
    sp = os.path.join(os.path.dirname(os.path.abspath(__file__)), "salt.bin")
    if not os.path.exists(sp): open(sp, "wb").write(os.urandom(16))
    salt, iv = open(sp, "rb").read(), os.urandom(12)
    ct = AESGCM(key(word, salt)).encrypt(iv, pt, None)
    payload = base64.b64encode(salt + iv + ct).decode()
    html = open(shell, encoding="utf-8").read().replace("__PAYLOAD__", payload).replace("__ITER__", str(ITER))
    open(out, "w", encoding="utf-8").write(html)

def decrypt(path, word):
    s = open(path, encoding="utf-8").read()
    it = int(re.search(r"const IT=(\d+)", s).group(1))
    raw = base64.b64decode(re.search(r'id="d">([^<]+)<', s).group(1))
    salt, iv, ct = raw[:16], raw[16:28], raw[28:]
    sys.stdout.buffer.write(AESGCM(key(word, salt, it)).decrypt(iv, ct, None))

if __name__ == "__main__":
    if sys.argv[1] == "encrypt": encrypt(*sys.argv[2:6])
    else: decrypt(*sys.argv[2:4])
