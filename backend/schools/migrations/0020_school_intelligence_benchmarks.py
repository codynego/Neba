from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("schools", "0019_assessmentreviewworkflow")]

    operations = [
        migrations.AddField(
            model_name="school",
            name="intelligence_review_threshold",
            field=models.DecimalField(decimal_places=2, default=60, max_digits=5),
        ),
        migrations.AddField(
            model_name="school",
            name="intelligence_strength_threshold",
            field=models.DecimalField(decimal_places=2, default=75, max_digits=5),
        ),
    ]
