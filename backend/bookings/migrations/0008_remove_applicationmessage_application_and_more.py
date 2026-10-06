from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("bookings", "0007_application_public_id")]

    operations = [
        migrations.DeleteModel(name="ApplicationMessage"),
        migrations.DeleteModel(name="TaskChange"),
        migrations.DeleteModel(name="TaskIssue"),
        migrations.DeleteModel(name="TaskMessage"),
        migrations.DeleteModel(name="Application"),
    ]
