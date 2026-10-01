import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("bookings", "0006_message_attachments")]

    operations = [
        migrations.AddField(
            model_name="application",
            name="public_id",
            field=models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
