from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("tasks", "0004_task_public_id")]

    operations = [
        migrations.AddField(
            model_name="task",
            name="reward_type",
            field=models.CharField(
                choices=[
                    ("money", "Money"),
                    ("food", "Food"),
                    ("item", "Item or goods"),
                    ("skill", "Skill or knowledge"),
                    ("service", "Service"),
                    ("exchange", "Exchange or barter"),
                    ("combination", "Combination"),
                    ("other", "Other"),
                ],
                default="money",
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name="task",
            name="reward_amount",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
