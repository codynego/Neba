import secrets
from django.db import migrations


def randomize_student_ids(apps, schema_editor):
    Student = apps.get_model("schools", "Student")
    for school_id in Student.objects.order_by().values_list("school_id", flat=True).distinct():
        used = set()
        for student in Student.objects.filter(school_id=school_id).order_by("id"):
            while True:
                value = f"{secrets.randbelow(900000) + 100000:06d}"
                if value not in used:
                    used.add(value)
                    student.student_id = value
                    student.save(update_fields=("student_id",))
                    break


class Migration(migrations.Migration):
    dependencies = [("schools", "0008_assessment_assignment_assessmentscore")]
    operations = [migrations.RunPython(randomize_student_ids, migrations.RunPython.noop)]
