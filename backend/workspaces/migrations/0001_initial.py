# Generated manually for the Neba Pro workspace MVP.
import django.db.models.deletion
from django.conf import settings
from django.db import migrations, models


class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(name="Business", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("name", models.CharField(max_length=120)), ("service_type", models.CharField(blank=True, max_length=80)),
            ("city", models.CharField(blank=True, max_length=120)), ("phone", models.CharField(blank=True, max_length=24)),
            ("slug", models.SlugField(blank=True, max_length=140, unique=True)),
            ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
            ("owner", models.OneToOneField(on_delete=django.db.models.deletion.CASCADE, related_name="business_workspace", to=settings.AUTH_USER_MODEL)),
        ]),
        migrations.CreateModel(name="Customer", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("name", models.CharField(max_length=120)), ("phone", models.CharField(blank=True, max_length=24)),
            ("address", models.CharField(blank=True, max_length=240)), ("notes", models.TextField(blank=True, max_length=1000)), ("created_at", models.DateTimeField(auto_now_add=True)),
            ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="customers", to="workspaces.business")),
        ], options={"ordering": ("name", "id")}),
        migrations.CreateModel(name="Job", fields=[
            ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
            ("title", models.CharField(max_length=160)), ("description", models.TextField(blank=True, max_length=2500)),
            ("address", models.CharField(blank=True, max_length=240)), ("requested_for", models.DateTimeField(blank=True, null=True)), ("assignee_name", models.CharField(blank=True, max_length=100)),
            ("status", models.CharField(choices=[("new", "New request"), ("quoted", "Quote sent"), ("confirmed", "Confirmed"), ("in_progress", "In progress"), ("completed", "Complete"), ("cancelled", "Cancelled")], db_index=True, default="new", max_length=16)),
            ("quote_amount", models.DecimalField(blank=True, decimal_places=2, max_digits=12, null=True)), ("deposit_amount", models.DecimalField(decimal_places=2, default=0, max_digits=12)), ("amount_paid", models.DecimalField(decimal_places=2, default=0, max_digits=12)),
            ("payment_status", models.CharField(choices=[("unpaid", "Unpaid"), ("partial", "Part paid"), ("paid", "Paid")], default="unpaid", max_length=12)), ("source", models.CharField(default="whatsapp", max_length=30)), ("ai_summary", models.TextField(blank=True, max_length=1500)),
            ("created_at", models.DateTimeField(auto_now_add=True)), ("updated_at", models.DateTimeField(auto_now=True)),
            ("business", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="jobs", to="workspaces.business")), ("customer", models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name="jobs", to="workspaces.customer")),
        ], options={"ordering": ("-updated_at", "-id")}),
    ]
