from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("opportunities", "0011_opportunity_requires_local_residency_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="opportunity",
            name="tracker_only",
            field=models.BooleanField(db_index=True, default=False),
        ),
    ]
