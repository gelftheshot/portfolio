# Keeping profiles in sync

A public fact starts in the website's data files. LinkedIn, Upwork and GitHub copy it from there.

- `data/profile.json` holds identity, location, links, employment, education, training credentials, languages and skills.
- `data/projects.json` holds the portfolio projects.
- `data/upwork.json` holds completed client work and the dated Upwork profile figures.

The website, the CV, `/llms.txt`, `/llms-full.txt`, the JSON-LD and the portfolio assistant are all built from these files. One edit updates them on the next deploy. LinkedIn, Upwork and GitHub do not read these files, so they change only when someone edits them by hand.

## When a fact changes

1. Change it in the data file first, through `/admin` or a commit. Check the deployed page.
2. On the same day, make the same change on LinkedIn, Upwork and GitHub. Names, dates, numbers and links must match. The wording can be shorter where a platform has a length limit.
3. Add one row to the log below. In each surface column, name the field you changed there. Write `n/a` if that surface has no place for the fact. If a surface could not be updated that day, write `pending` and give the reason in the notes, then edit the row when it is done.
4. If another platform is right and the website is wrong, fix the data file first and then follow these steps.

Platform titles are left out of this process. The website title, the LinkedIn headline, the Upwork title and the GitHub bio each stay as they are.

## Where each fact lives

| Fact | Website | LinkedIn | Upwork | GitHub |
| --- | --- | --- | --- | --- |
| Employment | `profile.experience` | Experience | Employment history | n/a |
| Education | `profile.education` | Education | Education | Profile README |
| Training credentials | `profile.certifications` | Licenses & certifications | Certifications | Profile README |
| Languages | `profile.languages` | Languages | Languages | n/a |
| Location | `profile.location` | Location | Location | Profile location |
| Website link | `profile.links.website` | Contact info, Featured | Portfolio items | Profile website, repository homepage |
| Skills | `profile.skills` | Skills | Skills | Repository topics |
| Projects | `data/projects.json` | Projects, Featured | Portfolio | Pinned repositories |
| Upwork figures | `upwork.profile` | About | Shown by Upwork | Profile README |

## Log

Newest row first. Use ISO dates (YYYY-MM-DD).

| Date | Fact or field | Website | LinkedIn | Upwork | GitHub | Notes |
| --- | --- | --- | --- | --- | --- | --- |
| 2026-11-07 | Skills | `profile.skills` unchanged | pending: add Docker, Kubernetes, CI/CD, React.js, PyTorch and others; remove five zero-endorsement duplicates | Added LangGraph, Next.js, PostgreSQL, Docker (20 of 20) | Topics added on academic-advisor-ai, ai-customer-support, inventory-management-app, portfolio | LinkedIn steps are in `tmp/linkedin/linkedin-updates-2026-11-07.md` |
| 2026-11-07 | Role descriptions, About, availability | `profile.experience`, `about`, `summary`, `workPreferences` rewritten (commit 7737e43) | pending: About and six Experience descriptions | pending: overview and six employment descriptions (connector confirm was denied) | n/a | Paste-ready text: `tmp/upwork/upwork-updates-2026-11-07.md` and the LinkedIn file above |
| 2026-11-07 | Project descriptions and case-study links | `data/projects.json` rewritten, per-project `updatedAt`, `sourceNote` | pending: Projects, Featured closers, Projuno and WanduBot entries | pending: 11 portfolio descriptions and lihongebre.com links (web editor only) | Pinned READMEs rewritten; portfolio repo homepage and description set | Dr. Infinity, ALX Study and Whisper claims left unchanged by request |
| 2026-11-07 | Credentials | unchanged | n/a | pending: n8n101 ID and badge link without expiry; ALX intranet link; AWS provider label | n/a | Web editor only |
| 2026-11-07 | Location, website, hireable | unchanged | pending: Contact info websites | n/a | pending: needs `gh auth refresh -s user` | GitHub token lacks the user scope |
