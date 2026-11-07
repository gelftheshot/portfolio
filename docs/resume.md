# CV editing and layout

The downloadable CV uses a concise selection of AI/backend experience, completed client work, three projects, education, and training. The website keeps its full employment history and portfolio. The CV retains the existing headline, including Workflow Automation. Portfolio links use the adopted `https://www.lihongebre.com` origin.

`data/resume.json` defines the curated employer IDs and approved client/project copy. Employer names, titles, periods, and `resumeBullets` come from `data/profile.json`; identity, contact details, links, and training dates also come from shared records. The Top Rated badge, total jobs, and feedback-entry count use the separately dated aggregate profile snapshot in `data/upwork.json`. Feedback entries are not necessarily written reviews. The selected client-engagement range describes the included work, not the start of a career or a current employment claim.

The PDF uses one column, standard section headings, selectable text, 11-point body text, 10.5-point contact/link text, and 42-point side margins on A4. Name and contact information are in the document body. Links retain readable domains and paths; text does not depend on icons, images, tables, or text boxes. The current content fits one page. Missing selected source records fail the build explicitly; longer edited content paginates instead of clipping.

`npm run resume:build` runs the Node/pdf-lib generator without Python or network access. It writes `public/Lihon-Gebre-CV.pdf` and `.txt`, working copies under ignored `output/pdf/`, and identical aliases at the former `Lihon-Gebre-Resume` paths. Production prebuild regenerates these files from the same content revision. After changes, render the PDF, inspect all pages, and check extracted text and link targets.

## Research basis — November 5, 2026

- [Greenhouse: unsuccessful résumé parsing](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) identifies columns, complex tables, graphics, image-only documents, and contact details in headers/footers as parsing risks.
- [MIT: résumé checklist](https://capd.mit.edu/resources/resume-checklist/) recommends readable 10–12-point fonts, consistent margins and formatting, relevant keywords, and clear experience descriptions.
- [MIT: using AI for a résumé](https://capd.mit.edu/resources/using-ai-for-your-resume-and-cv/) emphasizes matching truthful experience to a role, improving clarity and bullet structure, and checking AI-generated claims.
- [Harvard: 2026 industry résumé guidance](https://careerservices.fas.harvard.edu/blog/2026/09/15/resumes-for-industry-grad-student-edition-2026/) describes targeted content for human reviewers and automated screening, using language that reflects actual skills and experience.

Tailor emphasis and terminology to each job description while keeping the underlying facts intact. The published CV is a focused selection; older roles remain available on the portfolio.
