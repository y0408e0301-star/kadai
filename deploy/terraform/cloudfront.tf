# 公開用の URL（CloudFront）。ブラウザからは HTTPS で受け、EC2 の 80 番（nginx）へ HTTP で渡す
# 証明書は CloudFront の既定のもの（*.cloudfront.net）を使う

# AWS が用意しているキャッシュ・転送の設定
data "aws_cloudfront_cache_policy" "caching_optimized" {
  name = "Managed-CachingOptimized"
}

data "aws_cloudfront_cache_policy" "caching_disabled" {
  name = "Managed-CachingDisabled"
}

# Host 以外のヘッダー・クエリ文字列・Cookie をすべて EC2 へ渡す
data "aws_cloudfront_origin_request_policy" "all_viewer_except_host" {
  name = "Managed-AllViewerExceptHostHeader"
}

resource "aws_cloudfront_distribution" "kadai" {
  enabled         = true
  comment         = "kadai"
  is_ipv6_enabled = true
  # 日本を含む中で一番安い価格帯
  price_class = "PriceClass_200"

  origin {
    origin_id   = "ec2"
    domain_name = aws_eip.kadai.public_dns

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # API はキャッシュせず、すべてのメソッドとクエリ文字列（検索条件）をそのまま渡す
  ordered_cache_behavior {
    path_pattern             = "/api/*"
    target_origin_id         = "ec2"
    viewer_protocol_policy   = "redirect-to-https"
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    cache_policy_id          = data.aws_cloudfront_cache_policy.caching_disabled.id
    origin_request_policy_id = data.aws_cloudfront_origin_request_policy.all_viewer_except_host.id
  }

  # 画面の静的ファイル。キャッシュの長さは nginx の Cache-Control に従う
  default_cache_behavior {
    target_origin_id       = "ec2"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    cache_policy_id        = data.aws_cloudfront_cache_policy.caching_optimized.id
    compress               = true
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }
}
