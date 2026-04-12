# Build Prep Install List

This file is only a prep checklist. It is not authorization to install anything yet.

The order below is meant to minimize rework once implementation begins.

## 1. Core local development prerequisites

1. Install Git if it is not already present.
2. Install Homebrew if package management is needed on this Mac.
3. Install Node.js LTS so the web app, shared tooling, and CLIs run on a stable runtime.
4. Install the chosen JavaScript package manager once we lock it in. Default recommendation: `pnpm`.

## 2. Cloud and deployment CLIs

5. Install the Vercel CLI for project linking, environment pulls, preview/production workflow checks, and deployment debugging.
6. Install the Supabase CLI for local project linking, migration generation, schema application, and RLS verification.
7. Install the GitHub CLI if we want scripted PR, branch, and workflow inspection during the build.

## 3. Android development tooling

8. Install Android Studio for the native Android app workflow.
9. Inside Android Studio, install the Android SDK platform packages required by the chosen compile SDK version.
10. Install Android SDK Build-Tools for the selected Android API level.
11. Install an Android Emulator system image for local QA.
12. Install Android Platform-Tools so `adb` is available for emulator and device testing.

## 4. Optional but likely useful local tooling

13. Install a database GUI or SQL client only if it helps with Supabase inspection. This is optional because Supabase Studio already covers many needs.
14. Install a JSON/API testing tool only if we decide it adds value beyond automated tests and curl-based checks.

## 5. Accounts and remote project setup that accompany installs

15. Create or confirm access to the GitHub account/org that will own the repository.
16. Create or confirm access to the Vercel account/team that will own the web deployment.
17. Create or confirm access to the Supabase account/project that will own auth and database resources.
18. Create or confirm access to the Android publishing/testing destination we choose later, if mobile release distribution is needed.

## 6. Environment follow-up after installs

19. Authenticate the Vercel CLI.
20. Authenticate the Supabase CLI.
21. Authenticate the GitHub CLI if we decide to use it.
22. Verify Android Studio can open the SDK Manager and Emulator Manager successfully.
23. Verify `node`, the package manager, `vercel`, `supabase`, and `adb` all resolve on the command line.

## Notes

- Docker is intentionally not on this list because the reviewed deployment direction is Vercel-first, not VPS/Docker Compose.
- We should not install anything until the architecture and implementation plan are explicitly approved to move forward.
