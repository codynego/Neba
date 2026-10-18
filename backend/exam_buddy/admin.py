from django.contrib import admin

from .models import ContentSource, Exam, ExamBlueprint, ExamPaper, ExamVersion, GenerationJob, LearnerExamGoal, PracticeSession, Question, QuestionAttempt, Topic, TopicMastery


admin.site.register((Exam, ExamVersion, ExamBlueprint, ExamPaper, Topic, ContentSource, Question, LearnerExamGoal, PracticeSession, QuestionAttempt, TopicMastery, GenerationJob))
