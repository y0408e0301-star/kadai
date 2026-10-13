# 毎日 5:00（日本時間）に EC2 と RDS を止める（EventBridge Scheduler）
# 4:00 のデモデータのリセット（DemoResetService）のあとに止める
# 公開環境は見せるときだけ deploy/start.sh で起動する。止め忘れと、RDS が停止して 7 日たつと自動で起動することへの対策

resource "aws_iam_role" "scheduler" {
  name = "kadai-scheduler"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect    = "Allow"
      Principal = { Service = "scheduler.amazonaws.com" }
      Action    = "sts:AssumeRole"
    }]
  })
}

# 止める権限だけ。対象は kadai の EC2 と RDS に限る
resource "aws_iam_role_policy" "scheduler_stop" {
  name = "stop-kadai"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = concat(
      [{
        Effect   = "Allow"
        Action   = "ec2:StopInstances"
        Resource = aws_instance.kadai.arn
      }],
      var.enable_rds ? [{
        Effect   = "Allow"
        Action   = "rds:StopDBInstance"
        Resource = aws_db_instance.kadai[0].arn
      }] : []
    )
  })
}

resource "aws_scheduler_schedule" "stop_ec2" {
  name                         = "kadai-stop-ec2"
  schedule_expression          = "cron(0 5 * * ? *)"
  schedule_expression_timezone = "Asia/Tokyo"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:ec2:stopInstances"
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ InstanceIds = [aws_instance.kadai.id] })

    # 止まっているときも成功するので、やり直しは要らない
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}

resource "aws_scheduler_schedule" "stop_rds" {
  count                        = local.rds_count
  name                         = "kadai-stop-rds"
  schedule_expression          = "cron(0 5 * * ? *)"
  schedule_expression_timezone = "Asia/Tokyo"

  flexible_time_window {
    mode = "OFF"
  }

  target {
    arn      = "arn:aws:scheduler:::aws-sdk:rds:stopDBInstance"
    role_arn = aws_iam_role.scheduler.arn
    input    = jsonencode({ DbInstanceIdentifier = aws_db_instance.kadai[0].identifier })

    # すでに止まっているときはエラーになるが、止まっているので問題ない。やり直しはしない
    retry_policy {
      maximum_retry_attempts = 0
    }
  }
}
