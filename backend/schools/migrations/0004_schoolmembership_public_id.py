import uuid

from django.db import migrations, models


def populate_public_ids(apps, schema_editor):
    membership_model = apps.get_model("schools", "SchoolMembership")
    for membership in membership_model.objects.filter(public_id__isnull=True).iterator():
        membership.public_id = uuid.uuid4()
        membership.save(update_fields=("public_id",))


class Migration(migrations.Migration):
    dependencies = [("schools", "0003_student_public_id")]

    operations = [
        migrations.AddField(
            model_name="schoolmembership",
            name="public_id",
            field=models.UUIDField(editable=False, null=True),
        ),
        migrations.RunPython(
            code=populate_public_ids,
            reverse_code=migrations.RunPython.noop,
        ),
        migrations.AlterField(
            model_name="schoolmembership",
            name="public_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
