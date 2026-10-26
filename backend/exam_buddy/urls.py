from django.urls import path

from .views import CatalogView, CompleteSessionView, LearnAccessView, LearnerGoalsView, LearnerPerformanceView, PracticeAnswerView, PracticeSessionView, StudyPlanView, TutorView

urlpatterns = [
    path("catalog/", CatalogView.as_view()),
    path("goals/", LearnerGoalsView.as_view()),
    path("performance/", LearnerPerformanceView.as_view()),
    path("plan/", StudyPlanView.as_view()),
    path("access/", LearnAccessView.as_view()),
    path("tutor/", TutorView.as_view()),
    path("practice/", PracticeSessionView.as_view()),
    path("practice/<uuid:session_id>/", PracticeSessionView.as_view()),
    path("practice/<uuid:session_id>/answer/", PracticeAnswerView.as_view()),
    path("practice/<uuid:session_id>/complete/", CompleteSessionView.as_view()),
]
