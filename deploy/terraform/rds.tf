# データベース（RDS for PostgreSQL 17）。EC2 からだけ接続できる
# 月 20 ドル前後かかるので、enable_rds = true のときだけ作る

locals {
  rds_count = var.enable_rds ? 1 : 0
}

data "aws_subnets" "default" {
  filter {
    name   = "vpc-id"
    values = [data.aws_vpc.default.id]
  }
}

resource "aws_db_subnet_group" "kadai" {
  count      = local.rds_count
  name       = "kadai"
  subnet_ids = data.aws_subnets.default.ids
}

resource "aws_security_group" "db" {
  count       = local.rds_count
  name        = "kadai-db"
  description = "kadai database"
  vpc_id      = data.aws_vpc.default.id
}

# 5432 番は EC2 のセキュリティグループからだけ受け付ける
resource "aws_vpc_security_group_ingress_rule" "postgres_from_ec2" {
  count                        = local.rds_count
  security_group_id            = aws_security_group.db[0].id
  description                  = "PostgreSQL from kadai EC2"
  ip_protocol                  = "tcp"
  from_port                    = 5432
  to_port                      = 5432
  referenced_security_group_id = aws_security_group.web.id
}

resource "aws_db_instance" "kadai" {
  count          = local.rds_count
  identifier     = "kadai-db"
  engine         = "postgres"
  engine_version = "17"
  instance_class = "db.t4g.micro"

  allocated_storage = 20
  storage_type      = "gp3"
  storage_encrypted = true

  db_name  = "kanban"
  username = "kanban"
  # パスワードは RDS が作って Secrets Manager に保存する（Terraform にも state にも残らない）
  manage_master_user_password = true

  db_subnet_group_name   = aws_db_subnet_group.kadai[0].name
  vpc_security_group_ids = [aws_security_group.db[0].id]
  publicly_accessible    = false
  multi_az               = false

  # 自動バックアップは 1 日分。7 日にしようとしたら無料プランの上限を超えるとして拒否された（FreeTierRestrictionError）
  backup_retention_period = 1
  # 課題用なので削除時の最終スナップショットは取らない
  skip_final_snapshot = true
  # 誤って RDS を消す apply（enable_rds = false・destroy）を止める。後片付けのときだけ false にする
  deletion_protection = var.rds_deletion_protection
  apply_immediately   = true
}

# EC2 のロールに、DB のパスワード（シークレット）を読む権限を付ける
resource "aws_iam_role_policy" "read_db_secret" {
  count = local.rds_count
  name  = "read-db-secret"
  role  = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect   = "Allow"
      Action   = "secretsmanager:GetSecretValue"
      Resource = aws_db_instance.kadai[0].master_user_secret[0].secret_arn
    }]
  })
}
