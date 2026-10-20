from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("schools", "0016_attendancerecord")]

    operations = [
        migrations.CreateModel(
            name="AssessmentImport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source_name", models.CharField(max_length=255)),
                ("source_type", models.CharField(default="csv", max_length=24)),
                ("status", models.CharField(choices=[("completed", "Completed"), ("rejected", "Rejected")], max_length=16)),
                ("row_count", models.PositiveIntegerField(default=0)),
                ("saved_count", models.PositiveIntegerField(default=0)),
                ("error_count", models.PositiveIntegerField(default=0)),
                ("error_summary", models.JSONField(blank=True, default=list)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("assessment", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="imports", to="schools.assessment")),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="assessment_imports", to="schools.schoolmembership")),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="assessment_imports", to="schools.school")),
            ],
            options={"ordering": ("-created_at",)},
        ),
        migrations.AddField(
            model_name="assessmentscore",
            name="import_batch",
            field=models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="scores", to="schools.assessmentimport"),
        ),
    ]
