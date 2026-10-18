#!/usr/bin/env bash
# Operational build entrypoint for Coolify; no application credentials are consumed.
set -Eeuo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/../../.."
# Check the checkout and helper temporary filesystem before downloading build layers.
# This is a free-space check, not a quota or a guarantee for a remote Docker daemon.
if ! df -Pk . "${TMPDIR:-/tmp}" | awk 'NR > 1 && $4 < 2097152 { low = 1 } END { exit low }'; then
  echo 'At least 2 GiB free is required on the checkout and temporary filesystems.' >&2
  exit 1
fi
if [[ "$(docker info --format '{{.OSType}}/{{.CgroupVersion}}')" != 'linux/2' ]]; then
  echo 'Bounded builds require a Linux Docker engine with cgroup v2.' >&2
  exit 1
fi
builder="cdv-coolify-${COOLIFY_RESOURCE_UUID:-payments}"
if [[ ! "$builder" =~ ^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,90}$ ]]; then
  echo 'Invalid Coolify resource identifier.' >&2
  exit 1
fi
config=''
created=false
cleanup() {
  result=$?
  trap - EXIT
  if [[ "$created" == true ]]; then
    if ! docker buildx rm --force "$builder"; then
      echo 'Builder cleanup failed; inspect this named builder before retrying.' >&2
      result=1
    fi
  fi
  if [[ -n "$config" ]]; then rm -f -- "$config"; fi
  exit "$result"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# A stable resource name prevents overlapping builds; never delete an existing builder.
config=$(mktemp)
cat > "$config" <<'CONFIG'
[worker.oci]
max-parallelism = 1
gc = true
reservedSpace = "256MB"
maxUsedSpace = "1GB"
minFreeSpace = "8GB"
CONFIG
docker buildx create --name "$builder" --driver docker-container \
  --driver-opt 'image=moby/buildkit:v0.34.0@sha256:b059f8d7226d0b326bc871af489a5dddf65e36af4d20d14251b072974d9ee87c' \
  --driver-opt 'memory=1536m,memory-swap=1536m,cpu-period=100000,cpu-quota=100000,restart-policy=no' \
  --buildkitd-config "$config"
created=true
docker buildx inspect --bootstrap "$builder"
docker update --pids-limit 256 "buildx_buildkit_${builder}0"
limits=$(docker inspect --format '{{.HostConfig.Memory}}/{{.HostConfig.MemorySwap}}/{{.HostConfig.CpuPeriod}}/{{.HostConfig.CpuQuota}}/{{.HostConfig.PidsLimit}}' "buildx_buildkit_${builder}0")
if [[ "$limits" != '1610612736/1610612736/100000/100000/256' ]]; then
  echo 'Builder resource limits were not applied; refusing to build.' >&2
  exit 1
fi
docker buildx build --builder "$builder" --load \
  --file apps/worker/Dockerfile --target runtime \
  --tag canaldigital-messaging-worker:local .
