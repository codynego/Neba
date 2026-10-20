from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("schools", "0018_studentrosterimport")]

    operations = [
        migrations.AlterField(
            model_name="assessment",
            name="status",
            field=models.CharField(choices=[("draft", "Draft"), ("submitted", "Submitted for review"), ("reviewed", "Reviewed"), ("published", "Published")], default="draft", max_length=16),
        ),
    ]
