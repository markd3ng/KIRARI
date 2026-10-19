# Owner authorization — 2026-10-19

The Owner approved enabling IndexNow and authorized a real post-deployment
validation. The exact Production identity remains the previously approved
binding: team `team_NsBZHGUVnyygP7veiROKLuUx`, project
`prj_QNMVdxTkPOad4ynN4fwFCYEST8Jk` / `kirari-main`, canonical host
`kirari-main.vercel.app`.

The implementation uses a newly generated public IndexNow verification key in
the default Site profile and the repository Actions variable
`KIRARI_INDEXNOW_ENABLED=true`. The key is public protocol data, not a secret or
credential. Google Indexing API, Vercel credentials/settings, and manual deploy
operations remain out of scope.

The live deployment and IndexNow request are not proven by this authorization
record; see `production-validation.md` for fresh runtime evidence.
