# Supabase database trust anchor

prod-ca-2021.crt is the public CA certificate linked by the dedicated project's Database Settings → SSL configuration → Download certificate control.

Source: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Downloaded over verified HTTPS on 23 October 2026. This is a public trust certificate, not a private key. Set SUPABASE_CA_CERT_PATH to use it; rejectUnauthorized and hostname verification remain enabled. No global certificate store is changed.
