# Generated manually

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reminder", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="reminder",
            name="create_todo",
            field=models.BooleanField(default=False),
        ),
    ]

