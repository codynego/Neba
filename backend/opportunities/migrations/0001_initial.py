import django.db.models.deletion
import uuid
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]

    operations = [
        migrations.CreateModel(
            name="Opportunity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("public_id", models.UUIDField(db_index=True, default=uuid.uuid4, editable=False, unique=True)),
                ("title", models.CharField(max_length=220)), ("provider", models.CharField(max_length=180)), ("summary", models.TextField(max_length=1800)),
                ("category", models.CharField(choices=[("scholarship", "Scholarship"), ("grant", "Grant"), ("job", "Job"), ("internship", "Internship"), ("fellowship", "Fellowship"), ("competition", "Competition"), ("training", "Training"), ("startup", "Startup program"), ("funding", "Business funding")], max_length=24)),
                ("application_url", models.URLField(max_length=500)), ("deadline", models.DateTimeField(blank=True, db_index=True, null=True)),
                ("country", models.CharField(blank=True, max_length=120)), ("location_label", models.CharField(blank=True, max_length=140)), ("is_remote", models.BooleanField(default=False)),
                ("benefit", models.CharField(blank=True, max_length=220)), ("eligibility_notes", models.TextField(blank=True, max_length=1200)),
                ("eligible_countries", models.JSONField(blank=True, default=list)), ("education_levels", models.JSONField(blank=True, default=list)), ("fields_of_study", models.JSONField(blank=True, default=list)), ("employment_statuses", models.JSONField(blank=True, default=list)),
                ("min_age", models.PositiveSmallIntegerField(blank=True, null=True)), ("max_age", models.PositiveSmallIntegerField(blank=True, null=True)), ("requires_business", models.BooleanField(default=False)), ("is_published", models.BooleanField(db_index=True, default=True)),
                ("source_url", models.URLField(blank=True, max_length=500)), ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
            ], options={"ordering": ("deadline", "-created_at")},
        ),
        migrations.CreateModel(
            name="SavedOpportunity",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("saved", "Saved"), ("preparing", "Preparing"), ("applied", "Applied"), ("shortlisted", "Shortlisted"), ("awarded", "Awarded"), ("archived", "Archived")], default="saved", max_length=16)),
                ("note", models.TextField(blank=True, max_length=2000)), ("saved_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
                ("opportunity", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="saves", to="opportunities.opportunity")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="saved_opportunities", to=settings.AUTH_USER_MODEL)),
            ], options={"ordering": ("-updated_at",)},
        ),
        migrations.CreateModel(
            name="OpportunityApplication",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("status", models.CharField(choices=[("preparing", "Preparing"), ("applied", "Applied"), ("shortlisted", "Shortlisted"), ("interview", "Interview"), ("awarded", "Awarded"), ("unsuccessful", "Unsuccessful"), ("withdrawn", "Withdrawn")], default="preparing", max_length=16)),
                ("applied_at", models.DateTimeField(blank=True, null=True)), ("next_action", models.CharField(blank=True, max_length=240)), ("next_action_at", models.DateTimeField(blank=True, null=True)), ("notes", models.TextField(blank=True, max_length=4000)), ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
                ("opportunity", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="applications", to="opportunities.opportunity")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="opportunity_applications", to=settings.AUTH_USER_MODEL)),
            ], options={"ordering": ("next_action_at", "-updated_at")},
        ),
        migrations.AddConstraint(model_name="savedopportunity", constraint=models.UniqueConstraint(fields=("user", "opportunity"), name="one_save_per_user_opportunity")),
        migrations.AddConstraint(model_name="opportunityapplication", constraint=models.UniqueConstraint(fields=("user", "opportunity"), name="one_application_per_user_opportunity")),
        migrations.AddIndex(model_name="opportunity", index=models.Index(fields=["is_published", "category", "deadline"], name="opportuniti_is_publ_4258eb_idx")),
    ]
