from django.contrib import admin

from .models import Exam, ExamPaper, LearnerExamGoal, PracticeSession, Question, QuestionAttempt, Topic


admin.site.register((Exam, ExamPaper, Topic, Question, LearnerExamGoal, PracticeSession, QuestionAttempt))
