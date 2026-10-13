from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("schools", "0004_schoolmembership_public_id")]

    operations = [
        migrations.AddField(model_name="student", name="address_line", field=models.CharField(blank=True, max_length=240)),
        migrations.AddField(model_name="student", name="city", field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="student", name="state", field=models.CharField(blank=True, max_length=100)),
        migrations.AddField(model_name="student", name="guardian_name", field=models.CharField(blank=True, max_length=160)),
        migrations.AddField(model_name="student", name="guardian_phone", field=models.CharField(blank=True, max_length=32)),
        migrations.AddField(model_name="student", name="guardian_email", field=models.EmailField(blank=True, max_length=254)),
    ]
