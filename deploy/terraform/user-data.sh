#!/bin/bash
# EC2 の初回起動時に 1 回だけ実行される。進み具合は /var/log/cloud-init-output.log で見られる
set -eux

# API サーバー（Spring Boot）を動かす Java 21
dnf install -y java-21-amazon-corretto-headless

# データベース（PostgreSQL）を動かす Docker と Docker Compose
dnf install -y docker
systemctl enable --now docker
usermod -aG docker ec2-user
mkdir -p /usr/local/lib/docker/cli-plugins
curl -fsSL https://github.com/docker/compose/releases/download/v2.29.7/docker-compose-linux-aarch64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# メモリ 1 GB を補うスワップ 2 GB
dd if=/dev/zero of=/swapfile bs=1M count=2048
chmod 600 /swapfile
mkswap /swapfile
swapon /swapfile
echo '/swapfile none swap defaults 0 0' >> /etc/fstab
