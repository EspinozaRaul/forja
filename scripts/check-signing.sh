#!/usr/bin/env bash
#
# Forja — signing and build preflight.
#
#   scripts/check-signing.sh [profile]      preflight, before `eas build --local`
#   scripts/check-signing.sh --apk <apk>    verify a built artifact, before installing
#
# Why it exists: the build must not reach Expo's servers for anything, and the APK must be
# signed by the one key that signed every published build. Both are silent failures — the
# build succeeds, and then the phone refuses the install, or a secret lands where it should
# not be. Every check below is one of those failures, caught before the 10-minute build or
# before the phone.
#
# It never prints a secret value. Exit 0 = go ahead, 1 = stop.

set -uo pipefail
cd "$(dirname "$0")/.." || exit 1

# Colonless, uppercase: apksigner prints the digest without separators and keytool prints it
# with them, so both are normalised to this form before the comparison.
EXPECTED_FINGERPRINT="38E23AA31912457735A0CC3224919001CD546D8701B5B585628A4543E0A55098"
CREDENTIALS="credentials.json"

fails=0
fail() { printf 'FAIL  %s\n' "$1"; fails=$((fails + 1)); }
warn() { printf 'warn  %s\n' "$1"; }
pass() { printf 'ok    %s\n' "$1"; }
perms() { stat -f '%Lp' "$1" 2>/dev/null || stat -c '%a' "$1" 2>/dev/null || echo '?'; }

# Extracts one SHA-256 fingerprint from a digest listing, in the normalised form above.
# A SHA-1 digest (40 hex characters) never matches: the pattern needs 32 byte pairs.
fingerprint_of() { grep -oE '([0-9A-Fa-f]{2}:?){31}[0-9A-Fa-f]{2}' | head -1 | tr -d ':' | tr 'a-f' 'A-F'; }

SDK="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-$HOME/Library/Android/sdk}}"
AAPT=""
SIGNER=""
for candidate in "$SDK"/build-tools/*/aapt2; do [ -f "$candidate" ] && AAPT="$candidate"; done
for candidate in "$SDK"/build-tools/*/apksigner; do [ -f "$candidate" ] && SIGNER="$candidate"; done

# ---------------------------------------------------------------------------
# mode 1: verify a built artifact
# ---------------------------------------------------------------------------
verify_apk() {
  local apk="$1"
  printf 'Artifact check — %s\n\n' "$apk"

  if [ -z "$AAPT" ] || [ -z "$SIGNER" ]; then
    fail "no aapt2/apksigner under $SDK/build-tools — cannot check the artifact"
    return
  fi

  # 1. what the phone will show, and whether it can install over what is there
  local badging version_code
  badging=$("$AAPT" dump badging "$apk" 2>/dev/null | grep -E "^package")
  version_code=$(printf '%s' "$badging" | grep -oE "versionCode='[0-9]+'" | grep -oE '[0-9]+')
  printf '      %s\n' "$(printf '%s' "$badging" | grep -oE "versionName='[0-9.]+'")"
  printf '      versionCode=%s\n' "$version_code"
  if [ -z "$version_code" ]; then
    fail "could not read the versionCode"
  else
    pass "versionCode $version_code — must exceed the installed one or Android refuses the update"
  fi

  # 2. the signature: the whole update path depends on it
  local fp
  fp=$("$SIGNER" verify --print-certs "$apk" 2>/dev/null | fingerprint_of)
  if [ "$fp" = "$EXPECTED_FINGERPRINT" ]; then
    pass "signed by the published key (${fp:0:8}…) — installs over the app, database survives"
  elif [ -z "$fp" ]; then
    fail "apksigner reported no certificate"
  else
    fail "signed by ${fp:0:8}…, not ${EXPECTED_FINGERPRINT:0:8}… — installing it needs an uninstall, which deletes the database"
  fi

  # 3. R8 must be off: the class names it obfuscated are what the native bindings look up
  local hits
  hits=$(unzip -p "$apk" 'classes*.dex' 2>/dev/null | grep -ac 'expo/modules/sqlite/SQLiteModule')
  if [ "${hits:-0}" -gt 0 ]; then
    pass "R8 off ($hits class-name hits in the dex; a minified build reports 0)"
  else
    fail "the dex has no expo/modules/sqlite/SQLiteModule — R8 is on"
  fi

  # 4. the JS inside must be the JS you think it is
  local hash prev prev_hash
  hash=$(unzip -p "$apk" assets/index.android.bundle 2>/dev/null | shasum -a 256 | awk '{print $1}')
  printf '      bundle sha256 %s\n' "${hash:0:16}…"
  prev=""
  for candidate in build-*.apk; do
    [ -f "$candidate" ] || continue
    [ "$candidate" = "$apk" ] && continue
    if [ -z "$prev" ] || [ "$candidate" -nt "$prev" ]; then prev="$candidate"; fi
  done
  if [ -n "$prev" ]; then
    prev_hash=$(unzip -p "$prev" assets/index.android.bundle 2>/dev/null | shasum -a 256 | awk '{print $1}')
    if [ "$hash" = "$prev_hash" ]; then
      warn "the bundle is identical to $prev — no JS changed, which is only right for a rebuild"
    else
      pass "the bundle differs from $prev — the new JS is inside"
    fi
  fi
}

# ---------------------------------------------------------------------------
# mode 2: preflight the local build
# ---------------------------------------------------------------------------
preflight() {
  local profile="$1"
  printf 'Local build preflight — profile %s\n\n' "$profile"

  # 1. nothing may let the build reach Expo's servers
  if python3 - "$profile" <<'PY'
import json, sys
profile = sys.argv[1]
problems = []
with open('eas.json') as fh:
    eas = json.load(fh)
with open('app.json') as fh:
    app = json.load(fh)['expo']

if eas.get('cli', {}).get('appVersionSource') != 'local':
    problems.append("eas.json cli.appVersionSource is not 'local' — the versionCode would be read from Expo's servers")
build = eas.get('build', {}).get(profile, {})
if build.get('credentialsSource') != 'local':
    problems.append(f"eas.json build.{profile}.credentialsSource is not 'local' — the keystore would be read from Expo's servers")
if not isinstance(app.get('android', {}).get('versionCode'), int):
    problems.append("app.json android.versionCode is missing — appVersionSource 'local' needs it")

# R8 is not a build failure, it is a runtime one: it renames the class names the native
# bindings look up by reflection, so the app dies before it can render anything. Every
# APK built between 2026-09-13 and 2026-09-29 shipped with it on for that reason.
properties = {}
for plugin in app.get('plugins', []):
    if isinstance(plugin, list) and plugin and plugin[0] == 'expo-build-properties':
        properties = plugin[1].get('android') or {}
        break
for flag in ('enableMinifyInReleaseBuilds', 'enableShrinkResourcesInReleaseBuilds'):
    if properties.get(flag):
        problems.append(f"app.json enables expo-build-properties android.{flag} — R8 breaks the native bindings at runtime")

for problem in problems:
    print('FAIL  ' + problem)
sys.exit(1 if problems else 0)
PY
  then
    pass "eas.json and app.json keep the build local"
  else
    fails=$((fails + 1))
  fi

  # 1b. the generated native project must not keep R8 on behind app.json's back. It is
  # gitignored and regenerated by prebuild, so a stale copy can defeat the config above.
  if [ -f android/gradle.properties ]; then
    if grep -qE '^android\.enableMinifyInReleaseBuilds=true' android/gradle.properties; then
      fail "android/gradle.properties still has enableMinifyInReleaseBuilds=true — a local ./gradlew build would keep R8 on (run npx expo prebuild)"
    else
      pass "the generated android/gradle.properties does not enable R8"
    fi
  fi

  # 2. a secret must never be committable. Checked before the file exists, on purpose: the
  # ignore rule is the only thing that keeps it out of the repo the moment it is created,
  # and a rule that is missing while the file is missing is invisible otherwise.
  if git check-ignore -q "$CREDENTIALS"; then
    pass "$CREDENTIALS is git-ignored"
  else
    fail "$CREDENTIALS is not in .gitignore — add it before creating the file"
  fi

  # 3. the local credentials must exist
  if [ ! -f "$CREDENTIALS" ]; then
    fail "$CREDENTIALS is missing. Create it once with:
        npx eas-cli@latest credentials --platform android   →  'Update credentials.json'"
    return
  fi
  pass "$CREDENTIALS exists"

  if git ls-files --error-unmatch "$CREDENTIALS" >/dev/null 2>&1; then
    fail "$CREDENTIALS is TRACKED by git — remove it from the index and rotate the keystore passwords"
  else
    pass "$CREDENTIALS is not tracked"
  fi

  # 4. the keystore it points at
  local keystore
  keystore=$(python3 -c "import json;print(json.load(open('$CREDENTIALS'))['android']['keystore']['keystorePath'])" 2>/dev/null)
  if [ -z "$keystore" ]; then
    fail "$CREDENTIALS does not declare android.keystore.keystorePath"
  else
    if [ -f "$keystore" ]; then
      pass "keystore exists at $keystore"
      if git check-ignore -q "$keystore"; then
        pass "keystore is git-ignored"
      else
        fail "$keystore is not ignored — it would enter the repo and the build archive"
      fi
    else
      fail "keystore not found at $keystore"
    fi
  fi

  # 5. permissions: a keystore anyone on the machine can read is a leaked keystore
  local file mode
  for file in "$CREDENTIALS" "$keystore"; do
    [ -f "$file" ] || continue
    mode=$(perms "$file")
    if [ "$mode" = "600" ] || [ "$mode" = "400" ]; then
      pass "$file is $mode"
    else
      fail "$file is $mode — readable by others on this machine. Fix: chmod 600 $file"
    fi
  done

  # 6. the fingerprint: same key as every published build, or the update path is broken
  if [ -f "$keystore" ] && command -v keytool >/dev/null 2>&1; then
    local fp
    fp=$(KEYSTORE_PASS="$(python3 -c "import json;print(json.load(open('$CREDENTIALS'))['android']['keystore']['keystorePassword'])")" \
      keytool -list -v -keystore "$keystore" -storepass:env KEYSTORE_PASS 2>/dev/null | fingerprint_of)
    if [ "$fp" = "$EXPECTED_FINGERPRINT" ]; then
      pass "keystore is the published key (${fp:0:8}…)"
    elif [ -z "$fp" ]; then
      fail "could not read the keystore fingerprint — wrong password, or keytool failed"
    else
      fail "keystore is ${fp:0:8}…, expected ${EXPECTED_FINGERPRINT:0:8}… — an APK signed by it cannot install over the published app"
    fi
  elif ! command -v keytool >/dev/null 2>&1; then
    warn "keytool is not on PATH — the keystore fingerprint was not verified"
  fi
}

if [ "${1:-}" = "--apk" ]; then
  apk="${2:-}"
  if [ ! -f "$apk" ]; then
    echo "usage: $0 --apk <file.apk>"
    exit 1
  fi
  verify_apk "$apk"
  echo
  if [ "$fails" -eq 0 ]; then
    echo "OK TO INSTALL:  adb install -r $apk"
    exit 0
  fi
  echo "DO NOT INSTALL: $fails check(s) failed."
  exit 1
fi

PROFILE="${1:-preview}"
preflight "$PROFILE"
echo
if [ "$fails" -eq 0 ]; then
  echo "SAFE TO BUILD:  npx eas-cli@latest build --local --profile $PROFILE --platform android"
  exit 0
fi
echo "DO NOT BUILD: $fails check(s) failed."
exit 1
