import uuid
from django.db import migrations, models


def populate_public_ids(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    for user in User.objects.filter(public_id__isnull=True).iterator():
        user.public_id = uuid.uuid4()
        user.save(update_fields=("public_id",))


class Migration(migrations.Migration):
    dependencies = [("accounts", "0004_user_address_user_latitude_user_longitude_and_more")]
    operations = [
        migrations.AddField("user", "public_id", models.UUIDField(db_index=True, editable=False, null=True)),
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        migrations.AlterField("user", "public_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
    ]
