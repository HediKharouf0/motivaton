# APIs inventory

> Status legend:
> - \[ ] not completed yet
> - \[x] usable now
> - \[\~] possible but needs manual review / unofficial path

\---

## GitHub API

* Status: \[x] usable now
* Official API: Yes. GitHub has official REST and webhook support for apps and repositories.
* Authentication / requirements:

  * Public data can be fetched without authentication, but the limit is much lower.
  * For production use, prefer a Personal Access Token, OAuth token, GitHub App token, or `GITHUB\_TOKEN` in GitHub Actions.
  * Some endpoints and webhook setups require repository admin access or app permissions.
  * To create a repository webhook, you must be the repository owner or have admin access.
* Rate limit:

  * Unauthenticated: 60 requests/hour
  * Authenticated user: generally 5,000 requests/hour
  * `GITHUB\_TOKEN` in GitHub Actions: 1,000 requests/hour per repository
  * GitHub also applies secondary limits such as concurrent request limits and per-endpoint abuse protection.
* Webhook support:

  * Yes
  * Recommended for real-time tracking
  * Good events for this project:

    * `push`
    * `pull\_request`
* API calls needed:

  * Yes
  * Use API calls for:

    * initial sync
    * recount / resync
    * final verification before payout
    * pagination over commits / PRs
* Possible actions:

  * Get repository commits
  * Get a commit by SHA
  * Compare two commits
  * Get repository activity statistics
  * Get pull requests and PR commits
  * Get contributor stats
* Example useful challenge checks:

  * Number of commits in a repo over a time window
  * Whether a specific user committed to a specific repo
  * Whether a PR was opened / merged
  * Weekly contribution stats for a repo
* Example endpoints:

  * `GET /repos/{owner}/{repo}/commits`
  * `GET /repos/{owner}/{repo}/stats/contributors`
  * `GET /repos/{owner}/{repo}/compare/{base}...{head}`
* Backend integration pattern:

  * Hook endpoint: `/webhooks/github`
  * Verifier service: `githubVerifier.ts`
* Notes:

  * Best fit for challenges like `github:commit:30`
  * For “number of commits”, pagination and date filtering matter
  * Repo statistics endpoints can return `202` first while GitHub computes the data.
  * Best architecture: **webhook + API verification**.

\---

## Strava API

* Status: \[x] usable now
* Official API: Yes. Strava exposes an official V3 API and official webhook support.
* Authentication / requirements:

  * OAuth 2.0 required
  * All API requests require authentication
  * Developers must register an application to get a client ID and client secret
  * Users must sign in with Strava and grant scopes
  * If the product is intended for other users and not just your own testing, Strava asks you to submit the app for review.
* Rate limit:

  * Overall default: 200 requests / 15 minutes and 2,000 / day
  * Non-upload endpoints default: 100 requests / 15 minutes and 1,000 / day
* Webhook support:

  * Yes
  * Strongly recommended by Strava
  * Webhooks push activity or athlete updates to your callback
  * Best for near real-time updates and avoiding polling.
* API calls needed:

  * Yes
  * Use API calls for:

    * reading full activity details after a webhook arrives
    * reading athlete stats
    * listing activities over a time window
    * final verification before payout
* Possible actions:

  * Read athlete profile
  * Read athlete stats
  * Read activities
  * Read routes, clubs, gear, segments
  * Upload activities / files
  * Subscribe to webhooks for updates
* Example useful challenge checks:

  * Number of runs / rides in a period
  * Total distance in a period
  * Total moving time in a period
  * Whether a workout of a given type happened before a deadline
* Example endpoints:

  * `GET /athlete`
  * `GET /athletes/{id}/stats`
  * `GET /athlete/activities`
* Backend integration pattern:

  * Hook endpoint: `/webhooks/strava`
  * Verifier service: `stravaVerifier.ts`
* Notes:

  * Best fit for challenges like `strava:run\_count:12` or `strava:distance\_km:50`
  * Strava athlete stats only include activities with appropriate visibility
  * Best architecture: **webhook + API verification**
  * Webhooks are better than polling for live updates.

\---

## Duolingo

* Status: \[\~] possible but needs manual review / unofficial path
* Official API: No official public developer API confirmed in this draft.
* Authentication / requirements:

  * No verified official public developer onboarding confirmed here
  * Likely requires either private/internal endpoints or a partner/internal integration path if any exists
* Rate limit:

  * No official public rate-limit documentation confirmed here
* Webhook support:

  * No official public webhook support confirmed here
* API calls needed:

  * Not implementation-ready from an official public API path in this draft
* Possible actions we would want:

  * Read streak
  * Read XP gained in a period
  * Read lessons completed
  * Read course / language progress
* Example useful challenge checks:

  * XP earned before deadline
  * Number of lessons completed
  * Daily streak maintained
* Backend integration pattern:

  * For MVP: manual proof flow instead of direct integration
  * Suggested service: `duolingoManualVerifier.ts`
* Notes:

  * Best fit conceptually for challenges like `duolingo:xp:5000`
  * But this source is **not implementation-ready yet**
  * For MVP, Duolingo may need:

    * manual proof upload
    * screenshot verification
    * admin/manual approval

\---

## LeetCode

* Status: \[\~] possible but needs manual review / unofficial path
* Official API: No clearly documented official public developer API confirmed in this draft.
* Authentication / requirements:

  * No official public developer onboarding confirmed here
  * In practice, many community discussions refer to site behavior or GraphQL usage, but this still needs manual review before relying on it in production
* Rate limit:

  * No official public rate-limit documentation confirmed here
* Webhook support:

  * No official public webhook support confirmed here
* API calls needed:

  * Not implementation-ready from an official public API path in this draft
* Possible actions we would want:

  * Total solved problems
  * Solved count by difficulty
  * Contest rating / contest participation
  * Recent submissions
* Example useful challenge checks:

  * Solve N problems before deadline
  * Solve X medium problems
  * Reach a target contest rating
* Backend integration pattern:

  * For MVP: manual proof flow
  * Suggested service: `leetcodeManualVerifier.ts`
* Notes:

  * Best fit conceptually for challenges like `leetcode:solved:20`
  * But this is **not implementation-ready yet**
  * Needs a dedicated review of allowed/public endpoints and Terms compatibility before use

\---

## Chess.com

* Status: \[x] usable now
* Official API: Yes, but the public API is read-only. Chess.com documents the Published Data API for public data access.
* Authentication / requirements:

  * The public Published Data API (PubAPI) is read-only
  * It exposes public data only
  * If you want authenticated member access, app integration, or connected-board support, Chess.com asks developers to apply through their form/process.
* Rate limit:

  * Serial access is unlimited
  * Parallel requests may trigger rate limiting with `429 Too Many Requests`
  * Abnormal activity may result in temporary blocking
  * Include a clear `User-Agent` with contact info.
* Webhook support:

  * No official public webhook support confirmed in the PubAPI docs
* API calls needed:

  * Yes
  * This integration is effectively **polling / on-demand API only**
  * Use API calls for:

    * reading player profile
    * reading stats
    * checking archives
    * counting games / wins in a time period
* Possible actions:

  * Read public player profile
  * Read player stats
  * Read game archives
  * Read club / tournament / match data
* Example useful challenge checks:

  * Number of rapid/blitz games played in a period
  * Current rating in a time control
  * Number of wins in a month
  * Puzzle-related public stats if exposed for that user
* Example endpoints:

  * `GET https://api.chess.com/pub/player/{username}`
  * `GET https://api.chess.com/pub/player/{username}/stats`
  * `GET https://api.chess.com/pub/player/{username}/games/archives`
* Backend integration pattern:

  * No webhook route needed
  * Verifier service: `chessVerifier.ts`
  * Optional polling job: `chessPollingJob.ts`
* Notes:

  * Best fit for challenges like `chesscom:games:20` or `chesscom:rapid\_rating:1200`
  * Good candidate for MVP because public data is easy to read
  * Write actions are not available through the public read-only API
  * Best architecture: **API calls only**.

\---

## Coursera

* Status: \[\~] possible but needs manual review / partner access
* Official API: Limited / not openly documented like GitHub or Strava in this draft
* Authentication / requirements:

  * Coursera’s admin help center points to API and integrations access for organizations with **125+ learners**
  * Coursera for Teams is for **5 to 125** users, while Enterprise is for organizations with **more than 125 users**, and enterprise-level integrations are positioned there.
* Rate limit:

  * No public developer rate-limit documentation confirmed here
* Webhook support:

  * No official public webhook support confirmed here
* API calls needed:

  * No clear self-serve public developer path confirmed here for a normal MVP
* Possible actions we would want:

  * Course completion status
  * Progress percentage
  * Certificate earned
  * Assignment/module completion
* Example useful challenge checks:

  * Finish a course before deadline
  * Reach X% completion
  * Earn a certificate
* Backend integration pattern:

  * For MVP: manual proof flow
  * Suggested service: `courseraManualVerifier.ts`
* Notes:

  * Best fit conceptually for challenges like `coursera:course\_complete:1`
  * But this is **not MVP-ready** unless you get a valid official integration path
  * For early versions, Coursera may need manual proof verification
  * This looks more partner / enterprise-oriented than open self-serve.

\---

# Hook vs API-call summary

## Use **webhooks + API calls**

* GitHub
* Strava

## Use **API calls only**

* Chess.com

## Use **manual verification for MVP**

* Duolingo
* LeetCode
* Coursera

\---

# Recommended backend structure

```txt
/backend
  /webhooks
    github.ts
    strava.ts

  /verifiers
    githubVerifier.ts
    stravaVerifier.ts
    chessVerifier.ts
    duolingoManualVerifier.ts
    leetcodeManualVerifier.ts
    courseraManualVerifier.ts

  /jobs
    challengeExpiryJob.ts
    resyncGithubJob.ts
    resyncStravaJob.ts
    chessPollingJob.ts

  /ton
    submitSuccessToContract.ts
    submitRefundToContract.ts

