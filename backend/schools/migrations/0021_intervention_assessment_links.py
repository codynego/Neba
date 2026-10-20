from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("schools", "0020_school_intelligence_benchmarks")]

    operations = [
        migrations.AddField(model_name="academicintervention", name="baseline_assessment", field=models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name="class_intervention_baselines", to="schools.assessment")),
        migrations.AddField(model_name="academicintervention", name="follow_up_assessment", field=models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name="class_intervention_follow_ups", to="schools.assessment")),
        migrations.AddField(model_name="academicintervention", name="expected_review_date", field=models.DateField(blank=True, null=True)),
        migrations.AddField(model_name="academicintervention", name="outcome_status", field=models.CharField(blank=True, default="", max_length=24)),
        migrations.AddField(model_name="studentintervention", name="baseline_assessment", field=models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name="student_intervention_baselines", to="schools.assessment")),
        migrations.AddField(model_name="studentintervention", name="follow_up_assessment", field=models.ForeignKey(blank=True, null=True, on_delete=models.SET_NULL, related_name="student_intervention_follow_ups", to="schools.assessment")),
        migrations.AddField(model_name="studentintervention", name="expected_review_date", field=models.DateField(blank=True, null=True)),
        migrations.AddField(model_name="studentintervention", name="outcome_status", field=models.CharField(blank=True, default="", max_length=24)),
    ]
