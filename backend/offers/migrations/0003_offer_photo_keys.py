from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("offers", "0002_offer_public_id")]
    operations = [migrations.AddField(model_name="offer", name="photo_keys", field=models.JSONField(blank=True, default=list))]
