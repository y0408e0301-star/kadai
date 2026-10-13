#!/bin/bash
# DB の接続情報を Secrets Manager（RDS が作ったシークレット）から読み、API サーバーに渡す
# EC2 の /opt/kadai/bin/db-secret.sh に置き、root で実行する
#
#   db-secret.sh write   /run/kadai/db/ に DB_URL・DB_USERNAME・DB_PASSWORD のファイルを作る（kadai.service の起動前）
#   db-secret.sh check   パスワードが変わっていたら API サーバーを再起動する（kadai-db-secret-check.timer）
#
# 接続先は /etc/kadai/kadai.conf（setup.sh が作る）の DB_HOST と DB_SECRET_ARN
set -euo pipefail

source /etc/kadai/kadai.conf

dir=/run/kadai/db
# ARN（arn:aws:secretsmanager:<リージョン>:...）からリージョンを取り出す
region=$(cut -d: -f4 <<<"$DB_SECRET_ARN")

secret=$(aws secretsmanager get-secret-value --region "$region" --secret-id "$DB_SECRET_ARN" \
  --query SecretString --output text)
username=$(jq -r .username <<<"$secret")
password=$(jq -r .password <<<"$secret")

case "${1:-}" in
  write)
    # パスワードを含むので、API サーバーのユーザー（kadai）だけが読めるようにする
    mkdir -p "$dir"
    printf '%s' "jdbc:postgresql://${DB_HOST}:5432/kanban?sslmode=require" >"$dir/DB_URL"
    printf '%s' "$username" >"$dir/DB_USERNAME"
    printf '%s' "$password" >"$dir/DB_PASSWORD"
    chown -R kadai:kadai /run/kadai
    chmod 500 /run/kadai "$dir"
    chmod 400 "$dir"/*
    ;;
  check)
    if ! systemctl is-active --quiet kadai; then
      exit 0
    fi
    if [[ "$password" != "$(cat "$dir/DB_PASSWORD")" ]]; then
      echo "DB のパスワードが変わったので API サーバーを再起動する"
      systemctl restart kadai
    fi
    ;;
  *)
    echo "使い方: $0 write|check" >&2
    exit 2
    ;;
esac
