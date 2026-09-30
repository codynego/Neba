from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("tasks", "0005_task_reward_type_optional_amount")]
    operations = [migrations.AddField(model_name="task", name="photo_keys", field=models.JSONField(blank=True, default=list))]
