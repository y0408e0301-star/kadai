variable "region" {
  description = "AWS のリージョン"
  type        = string
  default     = "ap-northeast-1"
}

variable "instance_type" {
  description = "EC2 のインスタンスタイプ。無料プランの対象（t4g.micro など）から選ぶ"
  type        = string
  default     = "t4g.micro"
}

variable "enable_rds" {
  description = "RDS（PostgreSQL）を作るか。月 20 ドル前後かかるので、使うときだけ true にする"
  type        = bool
  default     = false
}

variable "ssh_cidr" {
  description = "SSH（22 番）を許可する接続元。空なら terraform を実行した PC のグローバル IP（/32）にする"
  type        = string
  default     = ""
}
