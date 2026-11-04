#!/usr/bin/env python3
"""Regenerate the public two-page resume from the shared public knowledge data.

Requires Python reportlab and Node.js supported by this repository. No network or
private environment values are used. JSON is obtained directly from the shared
knowledge builder so content changes do not require editing this document script.
"""

from __future__ import annotations

import json
import re
import shutil
import subprocess
import unicodedata
from datetime import date
from html import escape
from pathlib import Path
from urllib.parse import urlparse

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.platypus import (
    BaseDocTemplate,
    Frame,
    HRFlowable,
    KeepTogether,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
)


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf"
PUBLIC = ROOT / "public"
STEM = "Lihon-Gebre-Resume"
PAGE_WIDTH, PAGE_HEIGHT = A4
MARGIN = 43


def plain(value: object) -> str:
    """Use PDF-safe typography, including ASCII hyphens, in all visible text."""
    replacements = {
        "\u2010": "-", "\u2011": "-", "\u2012": "-", "\u2013": "-",
        "\u2014": "-", "\u2212": "-", "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"', "\u00a0": " ", "\u00b7": "|",
        "\u2026": "...",
    }
    value = str(value)
    for original, replacement in replacements.items():
        value = value.replace(original, replacement)
    return unicodedata.normalize("NFKC", value)


def html(value: object) -> str:
    return escape(plain(value), quote=True)


def sentences(text: str, limit: int = 1) -> str:
    return " ".join(re.split(r"(?<=[.!?])\s+(?=[A-Z])", plain(text))[:limit])


def link(label: str, url: str) -> str:
    return f'<a href="{escape(url, quote=True)}" color="#222222"><u>{html(label)}</u></a>'


def month_year(value: str) -> str:
    return date.fromisoformat(value).strftime("%b %Y")


def load_data() -> dict:
    program = (
        "import {buildAssistantKnowledge} from './lib/assistant-knowledge.js';"
        "process.stdout.write(JSON.stringify(buildAssistantKnowledge()));"
    )
    result = subprocess.run(
        ["node", "--no-warnings", "--input-type=module", "-e", program],
        cwd=ROOT, check=True, capture_output=True, text=True,
    )
    return json.loads(result.stdout)


class ResumeDocument(BaseDocTemplate):
    def __init__(self, filename: Path, name: str):
        super().__init__(
            str(filename), pagesize=A4, leftMargin=MARGIN, rightMargin=MARGIN,
            topMargin=36, bottomMargin=40, title=f"{name} - Resume",
            author=name, subject="AI, backend, and automation engineering resume",
            creator="Portfolio shared-data resume generator", pageCompression=1,
        )
        self.person_name = name
        self.pages_written = 0
        frame = Frame(
            self.leftMargin, self.bottomMargin, self.width, self.height,
            leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0,
        )
        self.addPageTemplates(PageTemplate(id="resume", frames=[frame], onPage=self.footer))

    def footer(self, canvas, doc):
        self.pages_written = max(self.pages_written, doc.page)
        canvas.saveState()
        canvas.setStrokeColor(colors.HexColor("#c5c5c5"))
        canvas.setLineWidth(0.4)
        canvas.line(MARGIN, 30, PAGE_WIDTH - MARGIN, 30)
        canvas.setFont("Helvetica", 7.5)
        canvas.setFillColor(colors.HexColor("#555555"))
        canvas.drawString(MARGIN, 18, plain(self.person_name))
        canvas.drawRightString(PAGE_WIDTH - MARGIN, 18, f"{doc.page} / 2")
        canvas.restoreState()


def build_resume(data: dict, pdf_path: Path) -> str:
    profile = data["profile"]
    client_work = data["clientWork"]
    projects = data["projects"][:3]
    name = profile["name"]
    email = data["contact"]["email"]
    links = profile["links"]
    styles = {
        "name": ParagraphStyle("name", fontName="Helvetica-Bold", fontSize=25, leading=29, spaceAfter=3),
        "position": ParagraphStyle("position", fontName="Helvetica", fontSize=11.5, leading=15, spaceAfter=7),
        "contact": ParagraphStyle("contact", fontName="Helvetica", fontSize=8.7, leading=12, textColor=colors.HexColor("#333333")),
        "section": ParagraphStyle("section", fontName="Helvetica-Bold", fontSize=10, leading=13, spaceBefore=13, spaceAfter=7),
        "body": ParagraphStyle("body", fontName="Helvetica", fontSize=9.4, leading=13, spaceAfter=4, alignment=TA_LEFT),
        "compact": ParagraphStyle("compact", fontName="Helvetica", fontSize=8.9, leading=12, spaceAfter=4),
        "role": ParagraphStyle("role", fontName="Helvetica-Bold", fontSize=9.5, leading=13, spaceAfter=3),
        "small": ParagraphStyle("small", fontName="Helvetica", fontSize=8.2, leading=11, textColor=colors.HexColor("#444444")),
        "continued": ParagraphStyle("continued", fontName="Helvetica-Bold", fontSize=16, leading=20, spaceAfter=5),
    }
    story = []
    text = []

    def para(value: str, style: str = "body", source: str | None = None):
        story.append(Paragraph(value, styles[style]))
        if source is not None:
            text.append(plain(source))

    def section(title: str):
        para(html(title.upper()), "section", title.upper())

    position = f'{profile["title"]} | Workflow Automation'
    para(html(name), "name", name)
    para(html(position), "position", position)
    para(f'{html(profile["location"])} | {link(email, "mailto:" + email)}', "contact", f'{profile["location"]} | {email}')
    website_label = urlparse(links["website"]).netloc
    github_label = urlparse(links["github"]).path.strip("/")
    linkedin_label = urlparse(links["linkedin"]).path.strip("/").removeprefix("in/")
    para(
        f'Portfolio: {link(website_label, links["website"])} &nbsp; | &nbsp; '
        f'GitHub: {link(github_label, links["github"])} &nbsp; | &nbsp; '
        f'LinkedIn: {link(linkedin_label, links["linkedin"])}',
        "contact",
        f'Portfolio: {links["website"]}\nGitHub: {links["github"]}\nLinkedIn: {links["linkedin"]}',
    )
    upwork_url = client_work["source"]["profileUrl"]
    para(f'Upwork: {link(client_work["profile"]["displayName"], upwork_url)}', "contact", f'Upwork: {upwork_url}')
    story.append(Spacer(1, 8))
    story.append(HRFlowable(width="100%", thickness=0.7, color=colors.HexColor("#333333")))

    section("Professional profile")
    summary = sentences(profile["summary"], 2)
    para(html(summary), source=summary)

    section("Technical skills")
    for category, skills in profile["skills"].items():
        value = ", ".join(skills)
        para(f'<b>{html(category)}:</b> {html(value)}', "compact", f'{category}: {value}')
    focus = ", ".join(profile["automationFocus"]["focusAreas"])
    para(f'<b>Automation:</b> {html(focus)}', "compact", f'Automation: {focus}')

    section("Employment history")
    for item in profile["experience"]:
        title = f'{item["company"]} | {item["role"]} | {item["period"]}'
        description = sentences(item["description"])
        focus = ", ".join(item["focusAreas"][:4])
        block = [
            Paragraph(html(title), styles["role"]),
            Paragraph(html(description), styles["compact"]),
            Paragraph(f'<b>Focus:</b> {html(focus)}', styles["small"]),
            Spacer(1, 8),
        ]
        story.append(KeepTogether(block))
        text.extend(["", plain(title), description, f'Focus: {plain(focus)}'])

    story.append(PageBreak())
    para(html(name), "continued", f'\n{name}')
    para(html(position), "contact")

    all_jobs = client_work["completedWork"]
    start_year = min(job["startDate"][:4] for job in all_jobs)
    end_year = max(job["endDate"][:4] for job in all_jobs)
    section(f"Selected client work - Upwork | {start_year}-{end_year}")
    snapshot = client_work["profile"].get("snapshotDate", client_work["source"]["retrievedAt"])
    snapshot_label = date.fromisoformat(snapshot).strftime("%b %d, %Y").replace(" 0", " ")
    stats = (
        f'{client_work["profile"]["completedJobCount"]} public completed jobs; '
        f'{client_work["profile"]["writtenReviewCount"]} written reviews. '
        f'{client_work["profile"]["badge"]}; '
        f'{client_work["profile"]["jobSuccessPercent"]}% Job Success '
        f'(profile snapshot: {snapshot_label}).'
    )
    para(html(stats), "compact", stats)
    para(
        f'Source: {link("Public Upwork profile and completed work", upwork_url)}.',
        "small", f'Source: {upwork_url}',
    )
    story.append(Spacer(1, 8))
    selected_ids = ["debug-502", "langchain-langgraph-saas", "knowledge-based-rag-chatbot", "ai-agent-development"]
    jobs_by_id = {job["id"]: job for job in all_jobs}
    selected_jobs = [jobs_by_id[key] for key in selected_ids if key in jobs_by_id]
    selected_jobs.sort(key=lambda job: job["endDate"], reverse=True)
    for job in selected_jobs:
        period = f'{month_year(job["startDate"])} - {month_year(job["endDate"])}'
        client = f'Client account: {job["clientName"]}' if job.get("clientName") else "Upwork client"
        detail = f'{period} | {client} | Client rating: {job["rating"]}/{job["ratingScale"]}'
        story.append(KeepTogether([
            Paragraph(html(job["title"]), styles["role"]),
            Paragraph(html(detail), styles["compact"]),
            Spacer(1, 7),
        ]))
        text.extend(["", plain(job["title"]), plain(detail)])

    section("Featured portfolio projects")
    for project in projects:
        case_url = project.get("caseStudyUrl") or links["website"].rstrip("/") + "/projects/" + project["slug"]
        role = f'Role: {project.get("role", profile["title"])}'
        story.append(KeepTogether([
            Paragraph(link(project["title"], case_url), styles["role"]),
            Paragraph(html(role), styles["small"]),
            Paragraph(html(project["description"]), styles["body"]),
            Paragraph(link("Read engineering case study", case_url), styles["small"]),
            Spacer(1, 10),
        ]))
        text.extend(["", plain(project["title"]), plain(role), plain(project["description"]), f'Case study: {case_url}'])

    certifications = profile.get("certifications", [])[:2]
    if certifications:
        section("Training and credentials")
        for credential in certifications:
            title = credential.get("name") or credential.get("title")
            if not title:
                continue
            provider = credential.get("provider") or credential.get("issuer")
            issued = credential.get("issued")
            parts = [title]
            formatted = link(title, credential["url"]) if credential.get("url") else html(title)
            if provider:
                formatted += f' | {html(provider)}'
                parts.append(provider)
            if issued:
                # Year-only/month-only source precision is retained in the PDF.
                issued_label = plain(issued)
                if re.fullmatch(r"\d{4}-\d{2}", issued_label):
                    issued_label = month_year(issued_label + "-01")
                formatted += f' | {html(issued_label)}'
                parts.append(issued_label)
            para(formatted, "compact", " | ".join(parts))
            if credential.get("url"):
                text.append(f'Credential: {credential["url"]}')

    section("Education")
    for item in profile["education"]:
        value = f'{item["degree"]} | {item["institution"]}'
        para(html(value), "compact", value)

    section("Languages")
    languages = " | ".join(f'{item["language"]}: {item["proficiency"]}' for item in profile["languages"])
    para(html(languages), "compact", languages)

    doc = ResumeDocument(pdf_path, name)
    doc.build(story)
    if doc.pages_written != 2:
        raise RuntimeError(f'Resume must fit two pages; generated {doc.pages_written}. Adjust layout before publishing.')
    return "\n".join(text).strip() + "\n"


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    PUBLIC.mkdir(exist_ok=True)
    data = load_data()
    master_pdf = OUTPUT / f'{STEM}.pdf'
    resume_text = build_resume(data, master_pdf)
    master_txt = OUTPUT / f'{STEM}.txt'
    master_txt.write_text(resume_text, encoding="utf-8")
    for artifact in [master_pdf, master_txt]:
        shutil.copyfile(artifact, PUBLIC / artifact.name)
    print(json.dumps({
        "pages": 2,
        "master": str(master_pdf),
        "publicPdf": str(PUBLIC / master_pdf.name),
        "publicText": str(PUBLIC / master_txt.name),
        "pdfBytes": master_pdf.stat().st_size,
        "textCharacters": len(resume_text),
        "employmentEntries": len(data["profile"]["experience"]),
        "trainingCredentials": len(data["profile"].get("certifications", [])[:2]),
        "featuredProjects": [project["title"] for project in data["projects"][:3]],
    }, indent=2))


if __name__ == "__main__":
    main()
