from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):
    dependencies = [("schools", "0015_classteacherassignment")]

    operations = [
        migrations.CreateModel(
            name="AttendanceRecord",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("date", models.DateField(default=django.utils.timezone.localdate)),
                ("status", models.CharField(choices=[("present", "Present"), ("late", "Late"), ("absent", "Absent"), ("excused", "Excused")], max_length=16)),
                ("note", models.CharField(blank=True, max_length=240)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("recorded_by", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="recorded_attendance", to="schools.schoolmembership")),
                ("school", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attendance_records", to="schools.school")),
                ("school_class", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="attendance_records", to="schools.schoolclass")),
                ("student", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="attendance_records", to="schools.student")),
            ],
            options={"ordering": ("-date", "student__last_name", "student__first_name")},
        ),
        migrations.AddConstraint(
            model_name="attendancerecord",
            constraint=models.UniqueConstraint(fields=("student", "date"), name="unique_student_attendance_date"),
        ),
        migrations.AddIndex(
            model_name="attendancerecord",
            index=models.Index(fields=["school_class", "date"], name="class_attendance_date_idx"),
        ),
    ]
