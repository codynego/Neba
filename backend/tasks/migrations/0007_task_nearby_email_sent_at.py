from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("tasks", "0006_task_photo_keys")]

    operations = [
        migrations.AddField(
            model_name="task",
            name="nearby_email_sent_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
