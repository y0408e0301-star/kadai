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
  cidr_ipv4         = var.ssh_cidr
}

# パッケージや Docker イメージの取得に使う
resource "aws_vpc_security_group_egress_rule" "all" {
  security_group_id = aws_security_group.web.id
  ip_protocol       = "-1"
  cidr_ipv4         = "0.0.0.0/0"
}

# EC2 のロール。権限は必要なものだけ別に付ける（RDS があるときはシークレットの読み取り: rds.tf）
# RDS の有無で付け外しすると、削除済みのプロファイルが EC2 に関連付いたまま残るので、常に付けておく
resource "aws_iam_role" "ec2" {
  name = "kadai-ec2"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "ec2.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

resource "aws_iam_instance_profile" "ec2" {
  name = "kadai-ec2"
  role = aws_iam_role.ec2.name
}

resource "aws_instance" "kadai" {
  ami                    = data.aws_ssm_parameter.al2023_arm64.value
  instance_type          = var.instance_type
  key_name               = aws_key_pair.kadai.key_name
  vpc_security_group_ids = [aws_security_group.web.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
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
    # 変えると EC2 が作り直しになる
    encrypted = true
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
