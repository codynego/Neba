from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


def create_current_enrollments(apps, schema_editor):
    Student = apps.get_model("schools", "Student")
    Enrollment = apps.get_model("schools", "StudentEnrollment")
    for student in Student.objects.select_related("school_class").iterator():
        Enrollment.objects.get_or_create(student_id=student.id, academic_session=student.school_class.academic_session, defaults={"school_id": student.school_id, "school_class_id": student.school_class_id})


class Migration(migrations.Migration):
    dependencies = [("schools", "0006_student_school_identifier")]
    operations = [
        migrations.CreateModel(name="StudentEnrollment", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("academic_session", models.CharField(max_length=40)), ("status", models.CharField(choices=[("active", "Active"), ("completed", "Completed"), ("transferred", "Transferred"), ("withdrawn", "Withdrawn")], default="active", max_length=16)), ("starts_at", models.DateField(default=django.utils.timezone.localdate)), ("ends_at", models.DateField(blank=True, null=True)), ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_enrollments", to="schools.school")), ("school_class", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="enrollments", to="schools.schoolclass")), ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="enrollments", to="schools.student"))]),
        migrations.CreateModel(name="StudentProgression", fields=[("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")), ("decision", models.CharField(choices=[("promoted", "Promoted"), ("repeating", "Repeating"), ("graduated", "Graduated"), ("transferred", "Transferred out"), ("withdrawn", "Withdrawn"), ("pending", "Pending")], default="pending", max_length=16)), ("effective_date", models.DateField(default=django.utils.timezone.localdate)), ("created_at", models.DateTimeField(auto_now_add=True)), ("approved_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="approved_progressions", to="schools.schoolmembership")), ("from_enrollment", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="progressed_from", to="schools.studentenrollment")), ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_progressions", to="schools.school")), ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="progressions", to="schools.student")), ("to_enrollment", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.PROTECT, related_name="progressed_to", to="schools.studentenrollment"))]),
        migrations.RunPython(create_current_enrollments, migrations.RunPython.noop),
        migrations.AddConstraint(model_name="studentenrollment", constraint=models.UniqueConstraint(fields=("student", "academic_session"), name="unique_student_session_enrollment")),
        migrations.AddConstraint(model_name="studentprogression", constraint=models.UniqueConstraint(fields=("student", "from_enrollment"), name="unique_student_progression_source")),
    ]
