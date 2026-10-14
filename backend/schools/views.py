from django.db import transaction
from django.db.models import Q
from django.contrib.auth import get_user_model
from django.utils import timezone
from django.utils.text import slugify
from rest_framework import permissions, serializers
from rest_framework.exceptions import PermissionDenied
from rest_framework.generics import get_object_or_404
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import AcademicIntervention, Assessment, AssessmentQuestion, AssessmentQuestionScore, AssessmentScore, Assignment, School, SchoolClass, SchoolMembership, Student, Subject, TeachingAssignment
from .permissions import active_membership_or_403, class_subject_access_or_403


class SchoolSetupSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=180)
    academic_session = serializers.CharField(max_length=40)
    classes = serializers.ListField(child=serializers.CharField(max_length=100), required=False, default=list)
    subjects = serializers.ListField(child=serializers.CharField(max_length=100), required=False, default=list)

    def validate(self, attrs):
        attrs["name"] = attrs["name"].strip()
        attrs["academic_session"] = attrs["academic_session"].strip()
        attrs["classes"] = list(dict.fromkeys(value.strip() for value in attrs["classes"] if value.strip()))
        attrs["subjects"] = list(dict.fromkeys(value.strip() for value in attrs["subjects"] if value.strip()))
        if not attrs["name"]:
            raise serializers.ValidationError({"name": "Enter your school name."})
        if not attrs["academic_session"]:
            raise serializers.ValidationError({"academic_session": "Enter the current academic session."})
        return attrs


def unique_school_slug(name):
    base = slugify(name)[:45] or "school"
    slug = base
    suffix = 2
    while School.objects.filter(slug=slug).exists():
        slug = f"{base[:40]}-{suffix}"
        suffix += 1
    return slug


def active_workspace_membership(request):
    """Resolve a requested workspace, always constrained to the signed-in member."""
    memberships = SchoolMembership.objects.select_related("school").filter(
        user=request.user,
        status=SchoolMembership.Status.ACTIVE,
    ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).order_by("created_at")
    requested_id = request.query_params.get("school_id") or request.data.get("school_id")
    if requested_id:
        membership = memberships.filter(school_id=requested_id).first()
        if membership is None:
            raise PermissionDenied("You do not have access to this school.")
        return membership
    return memberships.first()


def workspace_payload(membership):
    school = membership.school
    return {
        "id": school.id,
        "name": school.name,
        "slug": school.slug,
        "role": membership.role,
        "classes_count": school.classes.filter(is_active=True).count(),
        "subjects_count": school.subjects.filter(is_active=True).count(),
        "students_count": school.students.filter(is_active=True).count(),
    }


class SchoolSetupView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "school_setup"

    @transaction.atomic
    def post(self, request):
        serializer = SchoolSetupSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        data = serializer.validated_data
        school = School.objects.create(name=data["name"], slug=unique_school_slug(data["name"]))
        SchoolMembership.objects.create(school=school, user=request.user, role=SchoolMembership.Role.ADMIN, status=SchoolMembership.Status.ACTIVE)
        SchoolClass.objects.bulk_create([SchoolClass(school=school, name=name, academic_session=data["academic_session"]) for name in data["classes"]])
        Subject.objects.bulk_create([Subject(school=school, name=name) for name in data["subjects"]])
        return Response({"id": school.id, "name": school.name, "slug": school.slug}, status=201)


class SchoolWorkspaceView(APIView):
    """Return only the caller's first active school workspace, never another school's data."""

    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            return Response({"workspace": None, "workspaces": []})
        memberships = SchoolMembership.objects.select_related("school").filter(
            user=request.user, status=SchoolMembership.Status.ACTIVE,
        ).filter(Q(expires_at__isnull=True) | Q(expires_at__gt=timezone.now())).order_by("created_at")
        return Response({"workspace": workspace_payload(membership), "workspaces": [workspace_payload(item) for item in memberships]})


class StudentSerializer(serializers.ModelSerializer):
    class_name = serializers.CharField(source="school_class.name", read_only=True)
    full_name = serializers.CharField(read_only=True)

    class Meta:
        model = Student
        fields = ("id", "public_id", "student_id", "admission_year", "first_name", "last_name", "full_name", "admission_number", "address_line", "city", "state", "guardian_name", "guardian_phone", "guardian_email", "school_class", "class_name", "is_active")
        read_only_fields = ("id", "public_id", "student_id", "full_name", "class_name", "is_active")


class SchoolClassInputSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=100)
    academic_session = serializers.CharField(max_length=40)

    def validate(self, attrs):
        attrs["name"] = attrs["name"].strip()
        attrs["academic_session"] = attrs["academic_session"].strip()
        if not attrs["name"]:
            raise serializers.ValidationError({"name": "Enter a class name."})
        if not attrs["academic_session"]:
            raise serializers.ValidationError({"academic_session": "Enter an academic session."})
        return attrs


class SchoolRosterView(APIView):
    """Read and maintain the current member's own school roster."""

    permission_classes = [permissions.IsAuthenticated]

    def get_school_and_membership(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        return membership.school, membership

    def get(self, request):
        school, membership = self.get_school_and_membership(request)
        classes = school.classes.filter(is_active=True).values("id", "name", "academic_session")
        subjects = school.subjects.filter(is_active=True).values("id", "name", "code")
        students = school.students.select_related("school_class").filter(is_active=True)
        if membership.role == SchoolMembership.Role.TEACHER:
            assigned_class_ids = membership.teaching_assignments.filter(is_active=True).values_list("school_class_id", flat=True)
            students = students.filter(school_class_id__in=assigned_class_ids)
            classes = classes.filter(id__in=assigned_class_ids)
        members = school.memberships.none()
        if membership.role in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD}:
            members = school.memberships.select_related("user").filter(status=SchoolMembership.Status.ACTIVE).order_by("user__first_name", "user__username")
        return Response({
            "classes": list(classes),
            "subjects": list(subjects),
            "students": StudentSerializer(students, many=True).data,
            "members": [{
                "id": item.id,
                "public_id": item.public_id,
                "name": item.user.get_full_name() or item.user.display_name or item.user.username,
                "email": item.user.email,
                "role": item.role,
            } for item in members],
        })

    def post(self, request):
        school, membership = self.get_school_and_membership(request)
        if membership.role == SchoolMembership.Role.TEACHER:
            return Response({"detail": "Teachers cannot change the school roster."}, status=403)

        action = request.data.get("action")
        if action == "class":
            serializer = SchoolClassInputSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            school_class, created = SchoolClass.objects.get_or_create(
                school=school,
                name=serializer.validated_data["name"].strip(),
                academic_session=serializer.validated_data["academic_session"].strip(),
                defaults={"is_active": True},
            )
            if not created and not school_class.is_active:
                school_class.is_active = True
                school_class.save(update_fields=("is_active",))
            return Response({"id": school_class.id, "name": school_class.name, "academic_session": school_class.academic_session}, status=201 if created else 200)
        if action == "subject":
            name = str(request.data.get("name", "")).strip()
            code = str(request.data.get("code", "")).strip()
            if not name:
                raise serializers.ValidationError({"name": "Enter a subject name."})
            subject, created = Subject.objects.get_or_create(school=school, name=name, defaults={"code": code, "is_active": True})
            if not created and not subject.is_active:
                subject.is_active = True
                subject.code = code or subject.code
                subject.save(update_fields=("is_active", "code"))
            return Response({"id": subject.id, "name": subject.name, "code": subject.code}, status=201 if created else 200)
        if action == "student":
            serializer = StudentSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            school_class = serializer.validated_data["school_class"]
            if school_class.school_id != school.id:
                return Response({"detail": "The selected class is outside this school."}, status=403)
            student = serializer.save(school=school)
            return Response(StudentSerializer(student).data, status=201)
        if action == "member":
            email = str(request.data.get("email", "")).strip().lower()
            role = str(request.data.get("role", "")).strip()
            if not email:
                raise serializers.ValidationError({"email": "Enter the staff member's Neba email address."})
            if role not in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD, SchoolMembership.Role.TEACHER}:
                raise serializers.ValidationError({"role": "Choose a valid school role."})
            user = get_user_model().objects.filter(email__iexact=email).first()
            if user is None:
                raise serializers.ValidationError({"email": "No Neba account exists for this email yet."})
            school_member, created = SchoolMembership.objects.update_or_create(
                school=school,
                user=user,
                defaults={"role": role, "status": SchoolMembership.Status.ACTIVE, "expires_at": None},
            )
            return Response({"id": school_member.id, "public_id": school_member.public_id, "name": user.get_full_name() or user.display_name or user.username, "email": user.email, "role": school_member.role}, status=201 if created else 200)
        raise serializers.ValidationError({"action": "Choose class, subject, or student."})


class StudentDetailView(APIView):
    """Read and update one student only within the caller's selected school workspace."""

    permission_classes = [permissions.IsAuthenticated]

    def get_student_and_membership(self, request, public_id):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        students = Student.objects.select_related("school_class").filter(school=membership.school, public_id=public_id, is_active=True)
        if membership.role == SchoolMembership.Role.TEACHER:
            class_ids = membership.teaching_assignments.filter(is_active=True).values_list("school_class_id", flat=True)
            students = students.filter(school_class_id__in=class_ids)
        return get_object_or_404(students), membership

    def get(self, request, public_id):
        student, _membership = self.get_student_and_membership(request, public_id)
        return Response(StudentSerializer(student).data)

    def patch(self, request, public_id):
        student, membership = self.get_student_and_membership(request, public_id)
        if membership.role == SchoolMembership.Role.TEACHER:
            raise PermissionDenied("Teachers cannot update student records.")
        serializer = StudentSerializer(student, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        school_class = serializer.validated_data.get("school_class")
        if school_class is not None and school_class.school_id != membership.school_id:
            raise PermissionDenied("The selected class is outside this school.")
        serializer.save()
        return Response(StudentSerializer(student).data)


class SchoolMemberDetailView(APIView):
    """Read or change a school member's access, scoped to the active school."""

    permission_classes = [permissions.IsAuthenticated]

    def get_member_and_membership(self, request, public_id):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        if membership.role not in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD}:
            raise PermissionDenied("You cannot view school staff access.")
        member = get_object_or_404(SchoolMembership.objects.select_related("user").filter(school=membership.school, public_id=public_id, status=SchoolMembership.Status.ACTIVE))
        return member, membership

    def serialize_member(self, member):
        return {
            "public_id": member.public_id,
            "name": member.user.get_full_name() or member.user.display_name or member.user.username,
            "email": member.user.email,
            "role": member.role,
            "status": member.status,
            "created_at": member.created_at,
        }

    def get(self, request, public_id):
        member, _membership = self.get_member_and_membership(request, public_id)
        return Response(self.serialize_member(member))

    def patch(self, request, public_id):
        member, membership = self.get_member_and_membership(request, public_id)
        if membership.role != SchoolMembership.Role.ADMIN:
            raise PermissionDenied("Only school admins can change staff access.")
        role = str(request.data.get("role", "")).strip()
        if role not in {SchoolMembership.Role.ADMIN, SchoolMembership.Role.ACADEMIC_HEAD, SchoolMembership.Role.TEACHER}:
            raise serializers.ValidationError({"role": "Choose a valid school role."})
        member.role = role
        member.save(update_fields=("role", "updated_at"))
        return Response(self.serialize_member(member))


class TeachingWorkView(APIView):
    """Class-centred assessment and assignment records, always constrained to class/subject access."""
    permission_classes = [permissions.IsAuthenticated]

    def get_context(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        school_class = get_object_or_404(SchoolClass, id=request.query_params.get("class_id"), school=membership.school)
        subject = get_object_or_404(Subject, id=request.query_params.get("subject_id"), school=membership.school)
        class_subject_access_or_403(request.user, membership.school, school_class, subject)
        return membership, school_class, subject

    def get(self, request):
        _membership, school_class, subject = self.get_context(request)
        assessments = Assessment.objects.filter(school_class=school_class, subject=subject).prefetch_related("questions__scores")
        assignments = Assignment.objects.filter(school_class=school_class, subject=subject).order_by("-created_at")
        students = Student.objects.filter(school_class=school_class, is_active=True).values("id", "student_id", "first_name", "last_name")
        return Response({"students": list(students), "assessments": [{"id": item.id, "title": item.title, "type": item.assessment_type, "maximum_score": item.maximum_score, "status": item.status, "topics": item.topics, "entered_scores": item.scores.filter(status=AssessmentScore.EntryStatus.ENTERED).count(), "questions": [{"id": question.id, "number": question.number, "topic": question.topic, "learning_objective": question.learning_objective, "maximum_score": question.maximum_score, "scores": [{"student_id": score.student_id, "score": score.score, "status": score.status} for score in question.scores.all()]} for question in item.questions.all()]} for item in assessments], "assignments": [{"id": item.id, "title": item.title, "due_date": item.due_date, "status": item.status, "counts_toward_ca": item.counts_toward_ca} for item in assignments]})

    def post(self, request):
        membership, school_class, subject = self.get_context(request)
        action = request.data.get("action")
        if action == "assessment":
            item = Assessment(school=membership.school, school_class=school_class, subject=subject, academic_session=str(request.data.get("academic_session", school_class.academic_session)), term=str(request.data.get("term", "First term")), title=str(request.data.get("title", "")).strip(), assessment_type=request.data.get("assessment_type", Assessment.Type.CA), maximum_score=request.data.get("maximum_score"), weight=request.data.get("weight") or None, topics=str(request.data.get("topics", "")).strip(), created_by=membership)
            item.full_clean(); item.save()
            return Response({"id": item.id, "title": item.title, "status": item.status}, status=201)
        if action == "assignment":
            item = Assignment.objects.create(school=membership.school, school_class=school_class, subject=subject, title=str(request.data.get("title", "")).strip(), instructions=str(request.data.get("instructions", "")).strip(), due_date=request.data.get("due_date") or None, maximum_score=request.data.get("maximum_score") or None, counts_toward_ca=bool(request.data.get("counts_toward_ca")), created_by=membership)
            if not item.title:
                raise serializers.ValidationError({"title": "Enter an assignment title."})
            return Response({"id": item.id, "title": item.title, "status": item.status}, status=201)
        if action == "scores":
            assessment = get_object_or_404(Assessment, id=request.data.get("assessment_id"), school=membership.school, school_class=school_class, subject=subject, status=Assessment.Status.DRAFT)
            rows = request.data.get("scores", [])
            if not isinstance(rows, list):
                raise serializers.ValidationError({"scores": "Provide a list of student scores."})
            saved = 0
            for row in rows:
                student = get_object_or_404(Student, id=row.get("student_id"), school=membership.school, school_class=school_class, is_active=True)
                status = row.get("status", AssessmentScore.EntryStatus.ENTERED)
                score = row.get("score") if status == AssessmentScore.EntryStatus.ENTERED else None
                record, _ = AssessmentScore.objects.update_or_create(assessment=assessment, student=student, defaults={"score": score, "status": status, "entered_by": membership})
                record.full_clean(); record.save(); saved += 1
            return Response({"saved": saved})
        if action == "score_import":
            assessment = get_object_or_404(Assessment, id=request.data.get("assessment_id"), school=membership.school, school_class=school_class, subject=subject, status=Assessment.Status.DRAFT)
            rows = request.data.get("rows", [])
            if not isinstance(rows, list) or not rows:
                raise serializers.ValidationError({"rows": "Provide at least one score row."})
            parsed_rows, errors = [], []
            for index, row in enumerate(rows, start=2):
                student_id = str(row.get("student_id", "")).strip()
                try:
                    score = float(row.get("score"))
                except (TypeError, ValueError):
                    errors.append(f"Row {index}: enter a numeric score.")
                    continue
                student = Student.objects.filter(school=membership.school, school_class=school_class, student_id__iexact=student_id, is_active=True).first()
                if student is None:
                    errors.append(f"Row {index}: no active student matches '{student_id or 'blank'}'.")
                    continue
                if score < 0 or score > float(assessment.maximum_score):
                    errors.append(f"Row {index}: score must be between 0 and {assessment.maximum_score}.")
                    continue
                parsed_rows.append((student, score))
            if errors:
                raise serializers.ValidationError({"rows": errors[:12]})
            with transaction.atomic():
                for student, score in parsed_rows:
                    AssessmentScore.objects.update_or_create(assessment=assessment, student=student, defaults={"score": score, "status": AssessmentScore.EntryStatus.ENTERED, "entered_by": membership})
            return Response({"saved": len(parsed_rows), "source": "csv"})
        if action == "questions":
            assessment = get_object_or_404(Assessment, id=request.data.get("assessment_id"), school=membership.school, school_class=school_class, subject=subject, status=Assessment.Status.DRAFT)
            questions = request.data.get("questions", [])
            if not isinstance(questions, list) or not questions:
                raise serializers.ValidationError({"questions": "Add at least one mapped question."})
            seen, saved = set(), []
            for row in questions:
                try:
                    number = int(row.get("number"))
                except (TypeError, ValueError):
                    raise serializers.ValidationError({"questions": "Each question needs a valid number."})
                topic = str(row.get("topic", "")).strip()
                if number < 1 or number in seen or not topic:
                    raise serializers.ValidationError({"questions": "Question numbers must be unique and every question needs a topic."})
                seen.add(number)
                question, _ = AssessmentQuestion.objects.update_or_create(assessment=assessment, number=number, defaults={"topic": topic[:160], "learning_objective": str(row.get("learning_objective", "")).strip()[:300], "maximum_score": row.get("maximum_score") or None})
                question.full_clean(); question.save(); saved.append(question)
            AssessmentQuestion.objects.filter(assessment=assessment).exclude(number__in=seen).delete()
            return Response({"saved": len(saved), "questions": [{"id": item.id, "number": item.number, "topic": item.topic, "learning_objective": item.learning_objective, "maximum_score": item.maximum_score} for item in saved]})
        if action == "question_scores":
            assessment = get_object_or_404(Assessment, id=request.data.get("assessment_id"), school=membership.school, school_class=school_class, subject=subject, status=Assessment.Status.DRAFT)
            rows = request.data.get("scores", [])
            if not isinstance(rows, list) or not rows:
                raise serializers.ValidationError({"scores": "Provide question score rows."})
            saved = 0
            for row in rows:
                question = get_object_or_404(AssessmentQuestion, id=row.get("question_id"), assessment=assessment)
                student = get_object_or_404(Student, id=row.get("student_id"), school=membership.school, school_class=school_class, is_active=True)
                status = row.get("status", AssessmentQuestionScore.EntryStatus.ENTERED)
                score = row.get("score") if status == AssessmentQuestionScore.EntryStatus.ENTERED else None
                record, _ = AssessmentQuestionScore.objects.update_or_create(question=question, student=student, defaults={"score": score, "status": status, "entered_by": membership})
                record.full_clean(); record.save(); saved += 1
            return Response({"saved": saved})
        raise serializers.ValidationError({"action": "Choose assessment, assignment, score entry, CSV import, or question mapping."})


def _topic_labels(value):
    return list(dict.fromkeys(label.strip()[:160] for label in value.split(",") if label.strip()))


def _assessment_scope(membership):
    assessments = Assessment.objects.filter(school=membership.school).prefetch_related("scores", "questions__scores")
    if membership.role != SchoolMembership.Role.TEACHER:
        return assessments
    assignment_filters = Q()
    for assignment in TeachingAssignment.objects.filter(membership=membership, is_active=True):
        assignment_filters |= Q(school_class=assignment.school_class, subject=assignment.subject)
    return assessments.filter(assignment_filters) if assignment_filters else assessments.none()


class AcademicIntelligenceView(APIView):
    """Deterministic, explainable signals from topic-tagged assessment results."""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        assessments = _assessment_scope(membership).select_related("school_class", "subject")
        if request.query_params.get("class_id"):
            assessments = assessments.filter(school_class_id=request.query_params["class_id"])
        if request.query_params.get("subject_id"):
            assessments = assessments.filter(subject_id=request.query_params["subject_id"])

        total_percentages, assessed_students, topic_data = [], set(), {}
        for assessment in assessments:
            entered_scores = [score for score in assessment.scores.all() if score.status == AssessmentScore.EntryStatus.ENTERED and score.score is not None]
            if not entered_scores or not assessment.maximum_score:
                continue
            percentages = [float(score.score) / float(assessment.maximum_score) * 100 for score in entered_scores]
            total_percentages.extend(percentages)
            assessed_students.update(score.student_id for score in entered_scores)
            question_evidence = False
            for question in assessment.questions.all():
                question_scores = [score for score in question.scores.all() if score.status == AssessmentQuestionScore.EntryStatus.ENTERED and score.score is not None]
                if not question_scores or not question.maximum_score:
                    continue
                question_evidence = True
                topic = question.topic
                key = (assessment.school_class_id, assessment.subject_id, topic.casefold())
                item = topic_data.setdefault(key, {"topic": topic, "class_id": assessment.school_class_id, "class_name": assessment.school_class.name, "subject_id": assessment.subject_id, "subject_name": assessment.subject.name, "percentages": [], "assessment_ids": set(), "student_ids": set(), "question_level": False})
                item["percentages"].extend(float(score.score) / float(question.maximum_score) * 100 for score in question_scores)
                item["assessment_ids"].add(assessment.id)
                item["student_ids"].update(score.student_id for score in question_scores)
                item["question_level"] = True
            if not question_evidence:
                for topic in _topic_labels(assessment.topics):
                    key = (assessment.school_class_id, assessment.subject_id, topic.casefold())
                    item = topic_data.setdefault(key, {"topic": topic, "class_id": assessment.school_class_id, "class_name": assessment.school_class.name, "subject_id": assessment.subject_id, "subject_name": assessment.subject.name, "percentages": [], "assessment_ids": set(), "student_ids": set(), "question_level": False})
                    item["percentages"].extend(percentages)
                    item["assessment_ids"].add(assessment.id)
                    item["student_ids"].update(score.student_id for score in entered_scores)

        topic_signals = []
        for item in topic_data.values():
            average = round(sum(item["percentages"]) / len(item["percentages"]), 1)
            coverage = len(item["percentages"])
            confidence = "sufficient" if coverage >= 10 and len(item["assessment_ids"]) >= 2 else "early"
            topic_signals.append({
                "topic": item["topic"], "class_id": item["class_id"], "class_name": item["class_name"], "subject_id": item["subject_id"], "subject_name": item["subject_name"],
                "average": average, "assessed_students": len(item["student_ids"]), "assessments": len(item["assessment_ids"]), "coverage": coverage, "confidence": confidence,
                "evidence": f"{coverage} recorded {'question-level' if item['question_level'] else 'topic-tagged'} scores across {len(item['assessment_ids'])} assessment{'s' if len(item['assessment_ids']) != 1 else ''}.",
            })
        topic_signals.sort(key=lambda item: item["average"])
        interventions = AcademicIntervention.objects.filter(school=membership.school).select_related("school_class", "subject")
        if membership.role == SchoolMembership.Role.TEACHER:
            allowed = {(item.school_class_id, item.subject_id) for item in TeachingAssignment.objects.filter(membership=membership, is_active=True)}
            interventions = [item for item in interventions if (item.school_class_id, item.subject_id) in allowed]
        else:
            interventions = list(interventions)
        return Response({
            "summary": {"overall_average": round(sum(total_percentages) / len(total_percentages), 1) if total_percentages else None, "students_assessed": len(assessed_students), "topics_needing_attention": sum(item["average"] < 60 for item in topic_signals), "active_interventions": sum(item.status in {AcademicIntervention.Status.DRAFT, AcademicIntervention.Status.ACTIVE} for item in interventions)},
            "topic_signals": topic_signals,
            "interventions": [{"id": item.id, "topic": item.topic, "title": item.title, "status": item.status, "class_name": item.school_class.name, "subject_name": item.subject.name, "baseline_average": float(item.baseline_average) if item.baseline_average is not None else None} for item in interventions[:12]],
        })

    def post(self, request):
        membership = active_workspace_membership(request)
        if membership is None:
            raise serializers.ValidationError({"detail": "Set up a school workspace first."})
        school_class = get_object_or_404(SchoolClass, id=request.data.get("class_id"), school=membership.school)
        subject = get_object_or_404(Subject, id=request.data.get("subject_id"), school=membership.school)
        class_subject_access_or_403(request.user, membership.school, school_class, subject)
        topic = str(request.data.get("topic", "")).strip()
        if not topic:
            raise serializers.ValidationError({"topic": "Choose a topic before creating an intervention."})
        baseline = request.data.get("baseline_average")
        intervention = AcademicIntervention(school=membership.school, school_class=school_class, subject=subject, topic=topic[:160], title=str(request.data.get("title") or f"Focused {topic} revision").strip()[:180], rationale=str(request.data.get("rationale") or f"Teacher review requested after topic-tagged assessment evidence showed {topic} below the selected benchmark.").strip(), baseline_average=baseline or None, created_by=membership)
        intervention.full_clean(); intervention.save()
        return Response({"id": intervention.id, "title": intervention.title, "status": intervention.status, "topic": intervention.topic}, status=201)
