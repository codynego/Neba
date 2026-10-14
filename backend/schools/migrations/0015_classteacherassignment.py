from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [("schools", "0014_student_intervention")]

    operations = [
        migrations.CreateModel(
            name="ClassTeacherAssignment",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("starts_at", models.DateField(default=django.utils.timezone.localdate)),
                ("ends_at", models.DateField(blank=True, null=True)),
                ("is_active", models.BooleanField(default=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("membership", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="class_teacher_assignments", to="schools.schoolmembership")),
                ("school_class", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="class_teacher_assignments", to="schools.schoolclass")),
            ],
        ),
        migrations.AddConstraint(
            model_name="classteacherassignment",
            constraint=models.UniqueConstraint(fields=("membership", "school_class"), name="unique_class_teacher_assignment"),
        ),
    ]
