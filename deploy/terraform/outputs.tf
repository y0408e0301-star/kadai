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

output "ssh_command" {
  value = "ssh -i ${local_sensitive_file.ssh_private_key.filename} ec2-user@${aws_eip.kadai.public_dns}"
}
