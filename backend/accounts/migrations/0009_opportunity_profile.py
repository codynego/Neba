from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("accounts", "0008_pushsubscription")]

    operations = [
        migrations.AddField(model_name="user", name="business_status", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="user", name="country", field=models.CharField(blank=True, max_length=120)),
        migrations.AddField(model_name="user", name="date_of_birth", field=models.DateField(blank=True, null=True)),
        migrations.AddField(model_name="user", name="education_level", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="user", name="employment_status", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="user", name="field_of_study", field=models.CharField(blank=True, max_length=160)),
        migrations.AddField(model_name="user", name="financial_need", field=models.CharField(blank=True, max_length=80)),
        migrations.AddField(model_name="user", name="gender", field=models.CharField(blank=True, max_length=32)),
        migrations.AddField(model_name="user", name="goals", field=models.JSONField(blank=True, default=list)),
        migrations.AddField(model_name="user", name="gpa", field=models.CharField(blank=True, max_length=32)),
        migrations.AddField(model_name="user", name="graduation_year", field=models.PositiveSmallIntegerField(blank=True, null=True)),
        migrations.AddField(model_name="user", name="industry", field=models.CharField(blank=True, max_length=120)),
        migrations.AddField(model_name="user", name="institution", field=models.CharField(blank=True, max_length=180)),
        migrations.AddField(model_name="user", name="opportunity_interests", field=models.JSONField(blank=True, default=list)),
        migrations.AddField(model_name="user", name="years_experience", field=models.CharField(blank=True, max_length=32)),
    ]
