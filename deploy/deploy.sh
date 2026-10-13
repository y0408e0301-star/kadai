#!/bin/bash
# 公開環境（CloudFront → EC2 → RDS）に、手元のコミット済みのコードを反映する
# kadai フォルダで実行する（Windows では Git Bash）
#
#   bash deploy/deploy.sh
#
# 1. 画面と API サーバーをビルドする
# 2. EC2 へ転送し、deploy/server/setup.sh でサーバーの設定も最新にする
# 3. jar と画面を入れ替えて API サーバーを再起動し、公開 URL で動作を確かめる
#
# 接続先（EC2・RDS・公開 URL）と SSH の鍵は deploy/terraform（terraform apply 済み）から読む
set -euo pipefail

cd "$(dirname "$0")/.."

tf=deploy/terraform
key=$tf/kadai.pem
remote=/tmp/kadai-deploy

# まだコミットしていない変更は反映しない（どのコミットを公開したか分かるようにする）
if [[ -n "$(git status --porcelain)" ]]; then
  echo "コミットしていない変更があります。コミットしてから実行してください" >&2
  git status --short >&2
  exit 1
fi
branch=$(git branch --show-current)
if [[ "$branch" != main ]]; then
  echo "注意: main ではなく $branch を反映します"
fi
commit=$(git rev-parse --short HEAD)

ec2_dns=$(terraform -chdir=$tf output -raw public_dns)
db_host=$(terraform -chdir=$tf output -raw db_endpoint)
db_secret_arn=$(terraform -chdir=$tf output -raw db_secret_arn)
url=$(terraform -chdir=$tf output -raw url)
host=ec2-user@$ec2_dns
ssh_opts=(-i "$key" -o StrictHostKeyChecking=accept-new)

echo "== ビルド（$branch $commit）"
(cd frontend && npm ci && npm run build)
# テストは CI（GitHub Actions）で実行済みなので、ここでは飛ばす
(cd backend && ./mvnw -B -q package -DskipTests)
jar=$(ls backend/target/backend-*.jar)

echo "== EC2 へ転送（$ec2_dns）"
ssh "${ssh_opts[@]}" "$host" "rm -rf $remote && mkdir -p $remote"
scp "${ssh_opts[@]}" -q -r deploy/server frontend/dist "$host:$remote/"
scp "${ssh_opts[@]}" -q "$jar" "$host:$remote/app.jar"

echo "== サーバーの設定・入れ替え・再起動"
ssh "${ssh_opts[@]}" "$host" "sudo bash -s" <<EOF
set -euo pipefail
bash $remote/server/setup.sh '$db_host' '$db_secret_arn' >/dev/null

install -m 644 $remote/app.jar /opt/kadai/app.jar
# 画面は別のフォルダに置いてから入れ替える（途中の状態を見せない）
rm -rf /opt/kadai/www.new /opt/kadai/www.old
cp -r $remote/dist /opt/kadai/www.new
mv /opt/kadai/www /opt/kadai/www.old
mv /opt/kadai/www.new /opt/kadai/www
rm -rf /opt/kadai/www.old
echo '$commit' >/opt/kadai/COMMIT

systemctl restart kadai
for i in \$(seq 1 60); do
  if curl -sf http://127.0.0.1:8080/api/health >/dev/null; then
    echo "API サーバーが起動しました"
    rm -rf $remote
    exit 0
  fi
  sleep 2
done
echo "API サーバーが 2 分以内に起動しませんでした。ログ（journalctl -u kadai）:" >&2
journalctl -u kadai -n 50 --no-pager >&2
exit 1
EOF

echo "== 公開 URL で確認（$url）"
health=$(curl -sf "$url/api/health") || {
  echo "公開 URL から API サーバーに届きません" >&2
  exit 1
}
page=$(curl -s -o /dev/null -w "%{http_code}" "$url/")
echo "/api/health: $health"
echo "画面: $page"
if [[ "$page" != 200 ]]; then
  echo "画面が開けません" >&2
  exit 1
fi
echo "== 完了: $url（$commit）"
