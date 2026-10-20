from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [("schools", "0017_assessmentimport")]

    operations = [
        migrations.CreateModel(
            name="StudentRosterImport",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("source_name", models.CharField(max_length=255)),
                ("source_type", models.CharField(default="csv", max_length=24)),
                ("status", models.CharField(choices=[("completed", "Completed")], default="completed", max_length=16)),
                ("row_count", models.PositiveIntegerField(default=0)),
                ("created_count", models.PositiveIntegerField(default=0)),
                ("matched_count", models.PositiveIntegerField(default=0)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("created_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="student_roster_imports", to="schools.schoolmembership")),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="student_roster_imports", to="schools.school")),
            ],
            options={"ordering": ("-created_at",)},
        ),
    ]
