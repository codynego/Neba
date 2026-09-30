from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0006_user_legal_acceptance")]

    operations = [
        migrations.AddField(
            model_name="user",
            name="email_verified_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="nearby_task_emails",
            field=models.BooleanField(default=False),
        ),
    ]
