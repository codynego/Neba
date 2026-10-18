# Neba Learn — Exam Buddy MVP

Exam Buddy is the adaptive exam-preparation capability inside Neba Learn. It is not a promise to predict an examination paper.

## Product promise

Help a learner decide what to practise next using three inputs:

1. verified syllabus coverage;
2. verified question patterns and formats; and
3. the learner's own accuracy, response time, and repeated mistakes.

The learner sees this as **Exam Focus**: a transparent practice priority, never a claim that a topic or question will appear in the next sitting.

## MVP data model

The backend represents every supported route with the same structure:

`Exam → paper → topic → verified question → learner goal → practice session → attempt`

This permits different assessment formats without making one exam type the system default. A paper declares the formats it accepts, such as `multiple_choice`, `essay`, `calculation`, or `case_study`.

## Initial API

- `GET /api/exam-buddy/catalog/` — active exams, papers, and topics.
- `GET|POST /api/exam-buddy/goals/` — a learner's selected papers and study constraints.
- `POST /api/exam-buddy/practice/` — create a practice, revision, or mock session from verified questions.
- `GET /api/exam-buddy/practice/{session_id}/` — retrieve only the signed-in learner's session.
- `POST /api/exam-buddy/practice/{session_id}/answer/` — score one response and return an explanation.
- `POST /api/exam-buddy/practice/{session_id}/complete/` — return accuracy and topic-level revision priorities.

## Content and quality gate

Only questions marked `verified` are served in practice sessions. The source type records whether a question is original Neba content, licensed material, or a learner upload. Uploads must remain private until a content editor verifies both the rights and the answer quality.

Before an AI-generated question can be published, it needs a topic mapping, declared format and difficulty, a reference answer, an explanation, and editorial verification. Generated questions should be original; do not reproduce protected past papers or answer keys without permission.

## Next build increments

1. Add staff tooling for syllabus, question, and verification workflows.
2. Add a secure private-document ingestion pipeline for learner uploads.
3. Add an AI generation queue that creates drafts only, never automatically published questions.
4. Rank Exam Focus with syllabus priority, pattern frequency, freshness, and learner evidence; expose the factors behind every recommendation.
5. Add rubrics and human/AI assisted review for essays and calculation steps before supporting high-stakes marking.
