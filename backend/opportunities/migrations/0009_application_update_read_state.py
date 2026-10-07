from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("opportunities", "0008_merge_0007_application_changes")]

    operations = [
        migrations.AddField(model_name="opportunityapplication", name="applicant_updates_seen_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="opportunityapplication", name="poster_updates_seen_at", field=models.DateTimeField(blank=True, null=True)),
        migrations.AddField(model_name="opportunityapplication", name="status_updated_at", field=models.DateTimeField(blank=True, null=True)),
    ]
