from django.urls import path

from .views import CatalogView, CompleteSessionView, LearnerGoalsView, PracticeAnswerView, PracticeSessionView

urlpatterns = [
    path("catalog/", CatalogView.as_view()),
    path("goals/", LearnerGoalsView.as_view()),
    path("practice/", PracticeSessionView.as_view()),
    path("practice/<uuid:session_id>/", PracticeSessionView.as_view()),
    path("practice/<uuid:session_id>/answer/", PracticeAnswerView.as_view()),
    path("practice/<uuid:session_id>/complete/", CompleteSessionView.as_view()),
]
