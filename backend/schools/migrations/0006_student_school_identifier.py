from django.db import migrations, models


def populate_student_ids(apps, schema_editor):
    Student = apps.get_model("schools", "Student")
    school_ids = Student.objects.order_by().values_list("school_id", flat=True).distinct()
    for school_id in school_ids:
        for number, student in enumerate(Student.objects.filter(school_id=school_id).order_by("id"), start=1):
            student.student_id = f"{number:06d}"
            student.save(update_fields=("student_id",))


class Migration(migrations.Migration):
    dependencies = [("schools", "0005_student_contact_details")]

    operations = [
        migrations.AddField(model_name="student", name="student_id", field=models.CharField(editable=False, max_length=6, null=True)),
        migrations.RunPython(populate_student_ids, migrations.RunPython.noop),
        migrations.AlterField(model_name="student", name="student_id", field=models.CharField(editable=False, max_length=6)),
        migrations.AddConstraint(model_name="student", constraint=models.UniqueConstraint(fields=("school", "student_id"), name="unique_school_student_id")),
    ]
