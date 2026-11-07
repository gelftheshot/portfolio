# Discovery checks

These checks show how search engines and AI assistants find and describe Lihon. Write down only what you saw. Leave a cell empty if you did not check it that month.

Search Console and Bing Webmaster Tools show data only for a verified site. Sitemap submission is described in [publishing.md](publishing.md).

## Monthly

Do these in the first week of each month and fill in that month's row.

1. Google Search Console: open Performance, then Search results, and filter for queries that contain "lihon". Record impressions, clicks, average position and the page that ranks first. AI Overviews and AI Mode are counted inside the Web results; the report does not show them separately.
2. Bing Webmaster Tools: open AI Performance. Record the citation count and the cited pages.
3. Vercel: in Observability, open Edge Requests and group by bot name or bot category. Record which AI bots fetched pages and every path that returned 404 to them. These bot queries need Observability Plus.
4. Ask "Who is Lihon Gebre?" in ChatGPT with search on, in Perplexity, in Claude and in Gemini. For each, record the URL it cites and whether the facts match `data/profile.json`. Copy any wrong fact into the notes.
5. Upwork: under stats and trends, record search appearances.

When an answer has a wrong fact, find the page it came from and correct that page. If the website is the source, fix the data file first and follow [surface-sync.md](surface-sync.md).

| Month | Search Console, "lihon" queries | Bing AI citations | Vercel AI bots and 404s | ChatGPT | Perplexity | Claude | Gemini | Upwork search appearances | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-11 | | | | | | | | | |
| 2026-12 | | | | | | | | | |
| 2027-01 | | | | | | | | | |
| 2027-02 | | | | | | | | | |
| 2027-03 | | | | | | | | | |
| 2027-04 | | | | | | | | | |

## Quarterly

Do these in January, April, July and October, then fill in the quarter's row.

- [ ] Compare the website, the CV, LinkedIn, Upwork and GitHub item by item. Cover availability, location, the website link, each employer's name and dates, education, training credentials, languages, skills, projects and their links, the Upwork figures, reviews and the contact email. Look at the titles too, but do not copy them between platforms. Log every fix in [surface-sync.md](surface-sync.md).
- [ ] Open the four credential links. Each should load and show the same name, issuer and date as the website.
  - n8n102: https://badges.n8n.io/e80d3b99-1e3f-4049-8b70-41847d02805f
  - AWS Cloud Practitioner Essentials: https://www.coursera.org/account/accomplishments/verify/R8YYMZNSACZ4
  - ALX Software Engineering, Backend Specialization: https://intranet.alxswe.com/certificates/6Be8EZ2YPm
  - n8n101: https://badges.n8n.io/f4b913d8-8d0b-4d42-b3e3-29eda02115f2
- [ ] Test `https://www.lihongebre.com/` and one project page in https://validator.schema.org/ and in Google's Rich Results Test at https://search.google.com/test/rich-results. Record errors and warnings.
- [ ] Check every public repository for a tracked `.env` file:

  ```sh
  for repo in $(gh repo list gelftheshot --visibility public --limit 200 --json name --jq '.[].name'); do
    gh api "repos/gelftheshot/$repo/git/trees/HEAD?recursive=1" --jq '.tree[].path' \
      | grep -E '(^|/)\.env' | sed "s|^|$repo: |"
  done
  ```

  An `.env.example` with placeholder values is fine. Open every other match. If it holds real keys, treat them as leaked and rotate them. Deleting the file in a new commit is not enough, because it stays in the history.

| Quarter | Date checked | Cross-platform comparison | Credential links | Schema validator and Rich Results Test | Tracked `.env` files | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026 Q4 | | | | | | |
| 2027 Q1 | | | | | | |
| 2027 Q2 | | | | | | |
| 2027 Q3 | | | | | | |
