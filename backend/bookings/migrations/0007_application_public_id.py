import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("bookings", "0006_message_attachments")]

    def populate_public_ids(apps, schema_editor):
        Application = apps.get_model("bookings", "Application")
        for application in Application.objects.filter(public_id__isnull=True).iterator():
            application.public_id = uuid.uuid4()
            application.save(update_fields=("public_id",))

    operations = [
        migrations.AddField(
            model_name="application",
            name="public_id",
            field=models.UUIDField(null=True, editable=False),
        ),
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="application",
            name="public_id",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
