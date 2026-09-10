"""Validate one app's App Store profile and select an imported signing identity."""
import datetime
import hashlib
import os
from pathlib import Path
import plistlib
import re
import shutil
import subprocess


def export_options(profile, bundle_id, team_id, identities):
    entitlements = profile.get("Entitlements", {})
    if profile.get("TeamIdentifier") != [team_id]:
        raise ValueError("App Store profile belongs to a different Apple team.")
    prefixes = profile.get("ApplicationIdentifierPrefix", [])
    app_id = entitlements.get("application-identifier")
    if not any(app_id == prefix + "." + bundle_id for prefix in prefixes):
        raise ValueError("App Store profile does not match the archived Bundle ID.")
    if entitlements.get("get-task-allow", False):
        raise ValueError("Use an App Store profile, not a Development profile.")
    if "ProvisionedDevices" in profile or profile.get("ProvisionsAllDevices"):
        raise ValueError("Use an App Store profile, not Ad Hoc or Enterprise.")
    expiry = profile.get("ExpirationDate")
    if not expiry or expiry.replace(tzinfo=datetime.timezone.utc) <= datetime.datetime.now(datetime.timezone.utc):
        raise ValueError("App Store profile is expired or has no expiration date.")
    uuid = profile.get("UUID", "")
    if not re.fullmatch(r"[A-Fa-f0-9-]{36}", uuid):
        raise ValueError("App Store profile has an invalid UUID.")

    # find-identity only lists valid identities whose private keys are available.
    valid = set(re.findall(r'([A-Fa-f0-9]{40})\s+"Apple Distribution:', identities))
    matching = [hashlib.sha1(cert).hexdigest().upper()
                for cert in profile.get("DeveloperCertificates", [])]
    fingerprint = next((sha for sha in matching if sha in {item.upper() for item in valid}), None)
    if not fingerprint:
        raise ValueError("No valid Apple Distribution identity matches the profile. "
                         "Check the .p12, its private key, certificate expiry and WWDR trust chain.")
    return {
        "method": "app-store-connect",
        "destination": "upload",
        "signingStyle": "manual",
        "signingCertificate": fingerprint,
        "teamID": team_id,
        "provisioningProfiles": {bundle_id: uuid},
        "manageAppVersionAndBuildNumber": False,
        "uploadSymbols": True,
    }


def main():
    temp = Path(os.environ["RUNNER_TEMP"])
    archive = temp / (os.environ["XCODE_PROJECT"] + ".xcarchive")
    apps = list((archive / "Products/Applications").glob("*.app"))
    if len(apps) != 1:
        raise ValueError("Expected one application in the Xcode archive.")
    if list(apps[0].rglob("*.appex")) or (apps[0] / "Watch").exists():
        raise ValueError("Extensions and Watch apps need their own provisioning profile mappings.")
    with (apps[0] / "Info.plist").open("rb") as stream:
        bundle_id = plistlib.load(stream)["CFBundleIdentifier"]
    with (temp / "app-store-profile.plist").open("rb") as stream:
        profile = plistlib.load(stream)
    identities = subprocess.check_output(
        ["security", "find-identity", "-v", "-p", "codesigning",
         str(temp / "testflight.keychain-db")], text=True)
    options = export_options(profile, bundle_id, os.environ["APPLE_TEAM_ID"], identities)

    # Support both older Xcode and current Xcode provisioning profile locations.
    installed = []
    for directory in ("Library/MobileDevice/Provisioning Profiles",
                      "Library/Developer/Xcode/UserData/Provisioning Profiles"):
        target = Path.home() / directory / (profile["UUID"] + ".mobileprovision")
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(temp / "app-store.mobileprovision", target)
        installed.append(str(target))
    (temp / "testflight-profile-paths.txt").write_text("\n".join(installed) + "\n")
    with (temp / "ExportOptions.plist").open("wb") as stream:
        plistlib.dump(options, stream)
    print("Validated App Store profile and reusable distribution identity.")


if __name__ == "__main__":
    main()
