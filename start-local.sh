#!/usr/bin/env bash
set -euo pipefail
cd /home/kali/Desktop/Shop_uz--main
printf 'Savdoza: %s\n' "$PWD"
exec npm run dev -- --hostname 127.0.0.1
