import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("schools", "0002_student")]

    operations = [
        migrations.AddField(
            model_name="student",
            name="public_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
