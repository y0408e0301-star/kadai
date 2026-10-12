# 公開用サーバー（EC2 1 台）。入ってくる通信は CloudFront からの HTTP と、指定した IP からの SSH だけにする

data "aws_vpc" "default" {
  default = true
}

# Amazon Linux 2023（ARM 版）の最新の AMI
data "aws_ssm_parameter" "al2023_arm64" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-default-arm64"
}

data "aws_ec2_managed_prefix_list" "cloudfront" {
  name = "com.amazonaws.global.cloudfront.origin-facing"
}

# ssh_cidr を指定しなければ、terraform を実行した PC のグローバル IP を使う
data "http" "my_ip" {
  url = "https://checkip.amazonaws.com"
}

locals {
  ssh_cidr = var.ssh_cidr != "" ? var.ssh_cidr : "${chomp(data.http.my_ip.response_body)}/32"
}

# SSH の鍵。秘密鍵は kadai.pem に保存する（.gitignore 済み。state にも入るので state も共有しない）
resource "tls_private_key" "ssh" {
  algorithm = "ED25519"
}

resource "local_sensitive_file" "ssh_private_key" {
  filename        = "${path.module}/kadai.pem"
  content         = tls_private_key.ssh.private_key_openssh
  file_permission = "0600"
}

resource "aws_key_pair" "kadai" {
  key_name   = "kadai"
  public_key = tls_private_key.ssh.public_key_openssh
}

resource "aws_security_group" "web" {
  name        = "kadai-web"
  description = "kadai server"
  vpc_id      = data.aws_vpc.default.id
}

resource "aws_vpc_security_group_ingress_rule" "http_from_cloudfront" {
  security_group_id = aws_security_group.web.id
  description       = "HTTP from CloudFront"
  ip_protocol       = "tcp"
  from_port         = 80
  to_port           = 80
  prefix_list_id    = data.aws_ec2_managed_prefix_list.cloudfront.id
}

resource "aws_vpc_security_group_ingress_rule" "ssh" {
  security_group_id = aws_security_group.web.id
  description       = "SSH"
  ip_protocol       = "tcp"
  from_port         = 22
  to_port           = 22
  cidr_ipv4         = local.ssh_cidr
}

# パッケージや Docker イメージの取得に使う
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.web.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

resource "aws_instance" "kadai" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.value
  instance_type          = var.instance_type
  key_name               = aws_key_pair.kadai.key_name
  vpc_security_group_ids = [aws_security_group.web.id]
  user_data              = file("${path.module}/user-data.sh")

  # CPU を使い続けたときの追加料金（Unlimited モード）を発生させない
  credit_specification {
    cpu_credits = "standard"
  }

  metadata_options {
    http_tokens = "required"
  }

  root_block_device {
    volume_size = 10
    volume_type = "gp3"
  }

  tags = {
    Name = "kadai"
  }

  # AMI の更新のたびに作り直さない（作り直すときは terraform apply -replace を使う）
  lifecycle {
    ignore_changes = [ami]
  }
}

# 停止・起動しても変わらない IP（CloudFront の接続先にする）
resource "aws_eip" "kadai" {
  domain   = "vpc"
  instance = aws_instance.kadai.id

  tags = {
    Name = "kadai"
  }
}
