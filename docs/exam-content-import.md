# Exam Buddy content import

Exam content enters Neba as an editorial draft. Importing a file never makes a question visible to learners.

```powershell
cd backend
python manage.py import_exam_content path\to\exam-package.json
```

Use this shape:

```json
{
  "exam": {
    "name": "Exam name",
    "slug": "exam-name",
    "category": "school",
    "description": "Who this exam serves"
  },
  "papers": [
    {
      "name": "English Language",
      "code": "ENG",
      "duration_minutes": 60,
      "maximum_score": 100,
      "question_formats": ["multiple_choice"],
      "topics": [
        { "name": "Comprehension", "syllabus_priority": 5 }
      ],
      "questions": [
        {
          "reference": "stable-internal-reference-001",
          "source": "original",
          "topic": "Comprehension",
          "format": "multiple_choice",
          "difficulty": 2,
          "prompt": "Question text",
          "options": [
            { "id": "a", "text": "First option" },
            { "id": "b", "text": "Second option" }
          ],
          "correct_answer": { "option_id": "a" },
          "explanation": "Why the answer is correct",
          "learning_objective": "What this question checks"
        }
      ]
    }
  ]
}
```

For licensed or uploaded content, set `source` to `licensed` or `user_upload` and provide `source_name` plus `source_url`. The source begins in `pending` rights status. An editor must clear its rights before the admin publishing action will verify any linked question.

In Django admin, review each question's topic, wording, options, answer key, explanation, objective, difficulty, and source. Use **Publish selected questions as verified** only after that review. The action blocks incomplete questions and non-original material without a cleared source.
