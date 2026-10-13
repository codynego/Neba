import uuid

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("schools", "0003_student_public_id")]

    operations = [
        migrations.AddField(
            model_name="schoolmembership",
            name="public_id",
            field=models.UUIDField(default=uuid.uuid4, editable=False, unique=True),
        ),
    ]
