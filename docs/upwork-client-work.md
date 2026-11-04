# Upwork completed work and client feedback

The ten completed jobs were initially imported November 2, 2026 from Lihon's public Upwork work history. Their titles, dates, ratings, and written feedback were rechecked through the official Upwork plugin on November 3, 2026:
https://www.upwork.com/freelancers/~01dd5cefb217b3cbea

The official Upwork plugin was used in read-only mode: account selection, tool help, profile highlights, and a closed-contract search. Each existing public entry was matched to exactly one closed contract by its title, start date, and end date. No additional private contract rows were imported, and no Upwork profile, contract, proposal, message, or account setting was changed.

`data/upwork.json` contains the ten publicly displayed completed jobs, ten 5/5 client ratings, and nine written reviews. Titles and feedback retain their original spelling. The RAG chatbot review has a displayed excerpt with an explicit excerpt label; its full wording remains in the shared source for the portfolio assistant. The rating-only job has no invented testimonial.

At the user's request, the matching contracts' `clientOrganization.name` account display names were imported on November 3, 2026. Each entry includes `clientName` exactly as supplied by Upwork and `clientNameSource: "Upwork client account"`. All ten entries have a matching account name. This attribution identifies the Upwork client account associated with the job; it does not establish an individual review writer's identity or imply that an account name is a verified legal company name. No author identity was invented from a review, job title, or account name.

The profile displayed Top Rated and 100% Job Success in the original November 2 profile snapshot. These are dated Upwork profile indicators, not live badges or a calculated portfolio average. The profile's total-job count is distinct from its completed-job count. The November 3 refresh verifies the existing public work records and their matching client account attribution.

Only the existing public work-history records and the explicitly requested client account display names are included. Financial data, internal account and contract identifiers, client contact or other personal details, private terms, and ongoing work were excluded. The public profile URL remains the source link for each imported record.

The server-rendered client-work section, assistant export, JSON-LD work list, and `/llms.txt` all consume the same shared records. Client account attribution remains separate from individual review authorship. Structured reviews repeat displayed quotations and ratings without invented authors, aggregate ratings, or promises of search-result treatment.
