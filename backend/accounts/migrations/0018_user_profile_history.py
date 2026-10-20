from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0017_user_cv_profile"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="education_history",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="user",
            name="experience_history",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="user",
            name="languages",
            field=models.JSONField(blank=True, default=list),
        ),
    ]
