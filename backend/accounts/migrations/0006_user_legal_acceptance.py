from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0005_user_public_id")]

    operations = [
        migrations.AddField(
            model_name="user",
            name="legal_policy_version",
            field=models.CharField(blank=True, max_length=20),
        ),
        migrations.AddField(
            model_name="user",
            name="terms_accepted_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
