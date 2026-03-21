# APIs inventory

> Status legend:
> - [ ] not completed yet
> - [x] usable now
> - [~] possible but needs manual review / unofficial path

---

## GitHub API
- Status: [ ] not completed yet
- Official API: Yes
- Authentication / requirements:
  - Public data can be fetched without authentication, but the limit is much lower.
  - For real use, use a Personal Access Token, GitHub App token, OAuth token, or `GITHUB_TOKEN` in GitHub Actions.
  - Some endpoints require specific scopes / permissions. 
- Rate limit:
  - Unauthenticated: 60 requests/hour
  - Authenticated user: generally 5,000 requests/hour
  - GitHub also applies secondary limits such as concurrent request limits and per-endpoint abuse protection.
- Possible actions:
  - Get repository commits
  - Get a commit by SHA
  - Compare two commits
  - Get repository activity statistics
  - Get pull requests and PR commits
  - Get contributor stats
- Example useful challenge checks:
  - Number of commits in a repo over a time window
  - Whether a specific user committed to a specific repo
  - Whether a PR was opened / merged
  - Weekly contribution stats for a repo
- Example endpoints:
  - `GET /repos/{owner}/{repo}/commits`
  - `GET /repos/{owner}/{repo}/stats/contributors`
  - `GET /repos/{owner}/{repo}/compare/{base}...{head}`
- Notes:
  - Best fit for challenges like `github:commit:30`
  - For “number of commits”, pagination and date filtering matter
  - Repo statistics endpoints can return `202` first while GitHub computes the data

---

## Strava API
- Status: [ ] not completed yet
- Official API: Yes
- Authentication / requirements:
  - OAuth 2.0 required for normal use
  - Developers must register an application to get a client ID and client secret
  - Users must sign in with Strava and grant scopes
  - If the product is for other users and not just your own testing, Strava asks you to submit the app for review
- Rate limit:
  - Overall default: 200 requests / 15 minutes and 2,000 / day
  - Non-upload endpoints default: 100 requests / 15 minutes and 1,000 / day
- Possible actions:
  - Read athlete profile
  - Read athlete stats
  - Read activities
  - Read routes, clubs, gear, segments
  - Upload activities / files
  - Subscribe to webhooks for updates
- Example useful challenge checks:
  - Number of runs / rides in a period
  - Total distance in a period
  - Total moving time in a period
  - Whether a workout of a given type happened before a deadline
- Example endpoints:
  - `GET /athlete`
  - `GET /athletes/{id}/stats`
  - `GET /athlete/activities`
- Notes:
  - Best fit for challenges like `strava:run_count:12` or `strava:distance_km:50`
  - Strava athlete stats only include activities with appropriate visibility
  - Webhooks are better than polling for live updates

---

## Duolingo
- Status: [~] possible but needs manual review / unofficial path
- Official API: No official public developer API found in this pass
- Authentication / requirements:
  - No verified official public developer flow documented here yet
  - Likely requires either private/internal endpoints or a partner/internal integration path
- Rate limit:
  - Not documented from an official public developer source in this pass
- Possible actions we would want:
  - Read streak
  - Read XP gained in a period
  - Read lessons completed
  - Read course / language progress
- Example useful challenge checks:
  - XP earned before deadline
  - Number of lessons completed
  - Daily streak maintained
- Notes:
  - Best fit conceptually for challenges like `duolingo:xp:5000`
  - But this source is **not implementation-ready yet**
  - For MVP, Duolingo may need:
    - manual proof upload,
    - email/screenshot verification,
    - or a later unofficial integration reviewed carefully

---

## LeetCode
- Status: [~] possible but needs manual review / unofficial path
- Official API: No clearly documented public official API reference found in this pass
- Authentication / requirements:
  - No official public developer onboarding found here yet
  - In practice, many integrations rely on LeetCode web/GraphQL behavior, but that needs manual review before relying on it
- Rate limit:
  - No official public rate-limit documentation found in this pass
- Possible actions we would want:
  - Total solved problems
  - Solved count by difficulty
  - Contest rating / contest participation
  - Recent submissions
- Example useful challenge checks:
  - Solve N problems before deadline
  - Solve X medium problems
  - Reach a target contest rating
- Notes:
  - Best fit conceptually for challenges like `leetcode:solved:20`
  - But this is **not implementation-ready yet**
  - Needs a dedicated review of allowed/public endpoints and Terms compatibility before use

---

## Chess.com
- Status: [ ] not completed yet
- Official API: Yes, but the public one is read-only
- Authentication / requirements:
  - The public Published Data API (PubAPI) is read-only
  - It exposes public data only
  - Chess.com says if you want authenticated member access / app integration / connected board support, you should apply through their form
- Rate limit:
  - Public docs mention `429 Rate limit exceeded`
  - No numeric public rate-limit threshold confirmed here yet
- Possible actions:
  - Read public player profile
  - Read player stats
  - Read game archives
  - Read club / tournament / match data
- Example useful challenge checks:
  - Number of rapid/blitz games played in a period
  - Current rating in a time control
  - Number of wins in a month
  - Puzzle-related public stats if exposed for that user
- Example endpoints:
  - `GET https://api.chess.com/pub/player/{username}`
  - `GET https://api.chess.com/pub/player/{username}/stats`
  - `GET https://api.chess.com/pub/player/{username}/games/archives`
- Notes:
  - Best fit for challenges like `chesscom:games:20` or `chesscom:rapid_rating:1200`
  - Good candidate for MVP because public data is easy to read
  - Write actions are not available through the public read-only API

---

## Coursera
- Status: [~] possible but needs manual review / partner access
- Official API: Limited / not openly documented like GitHub or Strava
- Authentication / requirements:
  - Coursera support says the old APIs catalog is no longer available
  - Their admin help mentions API/integration access for organizations with 125+ learners
  - There also appears to be a developer / affiliate-oriented path rather than a broad public self-serve API
- Rate limit:
  - No public rate-limit documentation confirmed here
- Possible actions we would want:
  - Course completion status
  - Progress percentage
  - Certificate earned
  - Assignment/module completion
- Example useful challenge checks:
  - Finish a course before deadline
  - Reach X% completion
  - Earn a certificate
- Notes:
  - Best fit conceptually for challenges like `coursera:course_complete:1`
  - But this is **not MVP-ready** unless we get a valid official integration path
  - For early versions, Coursera may need manual proof verification

---

# Recommended MVP support order

1. GitHub
2. Strava
3. Chess.com
4. Duolingo
5. LeetCode
6. Coursera

Reason:
- GitHub, Strava, and Chess.com have the clearest usable paths right now.
- Duolingo and LeetCode are conceptually great, but the public official API path is unclear.
- Coursera looks more partner / enterprise-oriented than open self-serve.

---

# Suggested challenge-action mapping examples

## GitHub
- `github:commit:30`
- `github:pr_opened:3`
- `github:pr_merged:1`
- `github:repo_contribution_days:10`

## Strava
- `strava:run_count:12`
- `strava:distance_km:50`
- `strava:ride_count:8`
- `strava:moving_time_min:300`

## Duolingo
- `duolingo:xp:5000`
- `duolingo:lessons:40`
- `duolingo:streak_days:14`

## LeetCode
- `leetcode:solved:20`
- `leetcode:medium_solved:10`
- `leetcode:contest_participation:2`

## Chess.com
- `chesscom:games:20`
- `chesscom:wins:10`
- `chesscom:rapid_rating:1200`

## Coursera
- `coursera:course_complete:1`
- `coursera:certificate:1`
- `coursera:progress_percent:100`