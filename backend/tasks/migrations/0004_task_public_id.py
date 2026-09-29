import uuid
from django.db import migrations, models


def populate_public_ids(apps, schema_editor):
    Task = apps.get_model("tasks", "Task")
    for task in Task.objects.filter(public_id__isnull=True).iterator():
        task.public_id = uuid.uuid4()
        task.save(update_fields=("public_id",))


class Migration(migrations.Migration):
    dependencies = [("tasks", "0003_task_involves_item_task_item_already_paid_and_more")]
    operations = [
        migrations.AddField("task", "public_id", models.UUIDField(db_index=True, editable=False, null=True)),
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        migrations.AlterField("task", "public_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
    ]
