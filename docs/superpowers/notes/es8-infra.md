# ES8 Upgrade — Infrastructure Record

## New ES8 instance (Phase 4)
- **Instance:** `i-015129f445f20eec0` — t3a.medium, us-east-1c, Ubuntu 24.04.4 LTS
- **AMI:** `ami-0fbcf351e82d18381` (ubuntu-noble-24.04-amd64-server-20260529)
- **Public IP:** `44.200.241.128`  **Private IP:** `172.31.14.49`
- **Security group:** `sg-05389ee023da6bada` (es8-bordercore) — SSH(22)+9200 to the admin/client allowlist; no JMX/443
- **Data volume:** 35 GB gp3 at `/dev/sdf` → mounted `/var/lib/elasticsearch` (UUID b608bb42-5c12-4fba-89bb-271d7860a4d3, DeleteOnTermination=false)
- **Root:** 12 GB gp3 (DeleteOnTermination=true)
- **ES:** 8.17.1 via apt + systemd, heap 2 GB, `xpack.security.enabled: false`, ingest-attachment (bundled module)
- **Index:** `bordercore` created from mappings.json; `embeddings_vector` + `image_embedding` both indexed dense_vector (int8_hnsw, cosine); `attachment` ingest pipeline installed
- **SSH:** `ssh -i ~/JerrellSchiversAWS.pem ubuntu@44.200.241.128`

## Old ES7 instance (to decommission in Phase 7)
- **Instance:** `i-029f4cd137a6dac2b` — t3a.medium, us-east-1c, Ubuntu 18.04 (EOL)
- **Public IP:** `35.170.131.84`  **Private IP:** `172.31.14.43`
- **Security group:** `sg-0af074ec5a6fd9892` (launch-wizard-4)
- **ES:** 7.16.2, tar install in /home/elasticsearch, data on 35 GB gp2 (vol-01cd7869dd9bfddbc)
- **Index:** `bordercore` — 22,105 docs / 1.2 GB

## VPC
- vpc-2f389e55, public subnet subnet-2ff16448 (us-east-1c)
