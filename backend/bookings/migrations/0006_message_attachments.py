from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("bookings", "0005_remove_application_one_booking_offer_per_task_and_more")]

    operations = [
        migrations.AlterField(model_name="applicationmessage", name="text", field=models.TextField(blank=True, max_length=2000)),
        migrations.AddField(model_name="applicationmessage", name="attachments", field=models.JSONField(blank=True, default=list)),
        migrations.AlterField(model_name="taskmessage", name="text", field=models.TextField(blank=True, max_length=2000)),
        migrations.AddField(model_name="taskmessage", name="attachments", field=models.JSONField(blank=True, default=list)),
    ]
