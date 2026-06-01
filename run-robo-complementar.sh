#!/bin/bash

export TZ=America/Sao_Paulo

BASE_DIR="/home/rodrigo/projetodago/robos/RoboComplementar"
cd "$BASE_DIR" || exit 1

if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

LOG_DIR="$BASE_DIR/logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/cron_$(date +%F).log"

LOCK_FILE="/tmp/robo-complementar.lock"

{
  echo "[$(date)] 🔐 Tentando adquirir lock..."

  flock -n 200
  if [ $? -ne 0 ]; then
    echo "[$(date)] ⛔ Já existe uma execução em andamento. Abortando."
    exit 0
  fi

  echo "[$(date)] ✅ Lock adquirido. Iniciando Robô Complementar..."

  /usr/bin/node index.js

  echo "[$(date)] ✅ Robô Complementar finalizado."

} 200>"$LOCK_FILE" >> "$LOG" 2>&1
