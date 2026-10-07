from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("opportunities", "0006_opportunity_view_count_and_more")]

    operations = [migrations.AddField(model_name="opportunitymessage", name="read_at", field=models.DateTimeField(blank=True, null=True))]
