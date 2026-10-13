#!/bin/bash
# EC2 で画面（nginx）と API サーバー（systemd）を動かす準備をする。何度実行してもよい
# このフォルダ（deploy/server）を EC2 にコピーし、root で実行する
#
#   sudo bash setup.sh <DB_HOST> <DB_SECRET_ARN>
#
# DB_HOST・DB_SECRET_ARN は deploy/terraform の terraform output db_endpoint・db_secret_arn
# jar と画面はここでは置かない（/opt/kadai/app.jar と /opt/kadai/www/ に置く）
set -euo pipefail

if [[ $# -ne 2 ]]; then
  echo "使い方: sudo bash $0 <DB_HOST> <DB_SECRET_ARN>" >&2
  exit 2
fi

cd "$(dirname "$0")"

dnf install -y nginx jq

# API サーバーを動かすユーザー（ログインはできない）
id kadai &>/dev/null || useradd --system --no-create-home --shell /sbin/nologin kadai

install -d -m 755 /opt/kadai /opt/kadai/bin /opt/kadai/www
install -m 755 db-secret.sh /opt/kadai/bin/db-secret.sh

install -d -m 755 /etc/kadai
cat >/etc/kadai/kadai.conf <<EOF
DB_HOST=$1
DB_SECRET_ARN=$2
EOF
chmod 644 /etc/kadai/kadai.conf

install -m 644 nginx.conf /etc/nginx/conf.d/kadai.conf
install -m 644 kadai.service kadai-db-secret-check.service kadai-db-secret-check.timer /etc/systemd/system/
systemctl daemon-reload

nginx -t
systemctl enable --now nginx
systemctl reload nginx
systemctl enable --now kadai-db-secret-check.timer
# app.jar を置いてから systemctl restart kadai で起動する。ここでは再起動時に自動で起動する設定だけにする
systemctl enable kadai
