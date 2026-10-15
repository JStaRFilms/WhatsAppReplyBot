# Task25: Signed account/profile update

## Completion

Parent integrated the approved fixes. The review's discovery-revision P1 was fixed
with a create/return regression. All 177 tests, typechecks and actual APK signature,
version, embedded-bundle and privacy checks passed for 0.1.1/code2. The original
0.1.0 and private release key are preserved. No live account switch was performed.
Owner updates the APK and restarts the launcher, then confirms the chosen profile.
QR/device verification remains an owner action. Unrelated designer/contact-memory
documents are preserved and excluded from the commit.


## Scope

After one combined profile review, build Otherme0.1.1/code2 with same package and
approved release certificate, including task20safearea/inbox fixes and21/22account
scopes. Parent ownsbuildscripts and artifactverification. No selectedlogo yet;
keep appicons unchanged. Preserveexisting0.1.0APK and privatekey/password.

Use owner-approved C:/Otherme-build physicalbuildcopy; sync onlyexistingallowlisted
source/buildinputs andnevercredentials/runtime/privatekeys/designerfiles. Canonical
source isoriginalproject. Signing referencesoriginal.envonlyinGradleprocess.
NooutsideSDKinstall/automaticlicenseacceptance/cloudbuild/liveprofileswitch.

## Execution

Takomi Worker openai-codex/gpt-6-luna high:
node:delegated-task:command%3Amcp%3A71dc7a79-64d2-42f5-bb9c-4026e6ac54e9%3Adelegate-task%3Aotherme-profile-apk-20261015-r1
Parent fixed reviewP1 and all177tests/types pass. Worker onlysyncsallowlistedsource
and buildsverified0.1.1 usingexistingkey; no originalsource/livechanges.

## Deliverable and done

Verified .runtime/releases/Otherme-0.1.1.apk in originalproject, actualsignature/
version2/embeddedbundle/permissions/privacy scan. Workspacechecks andonefocused
reviewfixedconfirmedblockers. No forcedlivebackend rollout whileownerusesoldAPK;
coordinateupdateandexplicitprofilebinding. PhoneQR/hardware areowneractions.
Keepdesign/unselectedconceptfiles and unrelateddocsoutofcodecommit.
