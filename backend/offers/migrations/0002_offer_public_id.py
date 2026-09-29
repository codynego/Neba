import uuid
from django.db import migrations, models


def populate_public_ids(apps, schema_editor):
    Offer = apps.get_model("offers", "Offer")
    for offer in Offer.objects.filter(public_id__isnull=True).iterator():
        offer.public_id = uuid.uuid4()
        offer.save(update_fields=("public_id",))


class Migration(migrations.Migration):
    dependencies = [("offers", "0001_initial")]
    operations = [
        migrations.AddField("offer", "public_id", models.UUIDField(db_index=True, editable=False, null=True)),
        migrations.RunPython(populate_public_ids, migrations.RunPython.noop),
        migrations.AlterField("offer", "public_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
    ]
