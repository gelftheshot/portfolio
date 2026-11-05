# Résumé editing and layout

The downloadable résumé is a focused AI/backend/automation application document. It includes six employment records, three selected projects, four training credentials, education, and languages. Upwork ratings, client reviews, platform statistics, and profile links are excluded from this document. Portfolio links use the adopted `https://www.lihongebre.com` origin.

Use `profile.resumeSummary` and each experience record's `resumeBullets` for concise résumé copy. Both are editable in the admin; clearing an override falls back to the public profile/role description. Keep bullets specific to the supplied role scope and preserve factual dates and credentials. The generator curates relevant skill groups from the public skill records and includes the first three portfolio projects.

The PDF uses a single column, standard section headings, selectable text, 11-point body text, 10.5-point contact/link text, and approximately 0.7-inch margins. Name and contact information are in the document body. Links retain readable full domains and paths; résumé text does not depend on icons, images, tables, or text boxes. The current content uses two pages; longer edited histories paginate.

## Research basis — November 5, 2026

- [Greenhouse: unsuccessful résumé parsing](https://support.greenhouse.io/hc/en-us/articles/200989175-Unsuccessful-resume-parse) identifies columns, complex tables, graphics, image-only documents, and contact details in headers/footers as parsing risks.
- [MIT: résumé checklist](https://capd.mit.edu/resources/resume-checklist/) recommends readable 10–12-point fonts, consistent margins and formatting, relevant keywords, and clear experience descriptions.
- [MIT: using AI for a résumé](https://capd.mit.edu/resources/using-ai-for-your-resume-and-cv/) emphasizes matching truthful experience to a role, improving clarity and bullet structure, and checking AI-generated claims.
- [Harvard: 2026 industry résumé guidance](https://careerservices.fas.harvard.edu/blog/2026/09/15/resumes-for-industry-grad-student-edition-2026/) describes targeted content for human reviewers and automated screening, using language that reflects actual skills and experience.

The published version is a general-purpose master résumé. Tailor emphasis and terminology to each job description while keeping its facts intact. Regenerate with `npm run resume:build`, render both PDF pages, inspect the layout, and verify extracted text and link targets before publishing. Production builds regenerate the PDF and plain-text download from the same content revision.
