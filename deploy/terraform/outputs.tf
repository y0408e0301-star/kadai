output "instance_id" {
  value = aws_instance.kadai.id
}

output "public_ip" {
  value = aws_eip.kadai.public_ip
}

output "public_dns" {
  description = "CloudFront の接続先やデプロイ（EC2_DNS）に使う"
  value       = aws_eip.kadai.public_dns
}

output "url" {
  description = "公開 URL（CloudFront）"
  value       = "https://${aws_cloudfront_distribution.kadai.domain_name}"
}

output "db_endpoint" {
  description = "RDS の接続先（EC2 からだけ届く）。enable_rds = false なら null"
  value       = var.enable_rds ? aws_db_instance.kadai[0].address : null
}

output "db_secret_arn" {
  description = "DB のユーザー名とパスワードが入ったシークレット。enable_rds = false なら null"
  value       = var.enable_rds ? aws_db_instance.kadai[0].master_user_secret[0].secret_arn : null
}

output "ssh_command" {
  value = "ssh -i ${local_sensitive_file.ssh_private_key.filename} ec2-user@${aws_eip.kadai.public_dns}"
}
