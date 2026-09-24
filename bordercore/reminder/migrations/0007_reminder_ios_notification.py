from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("reminder", "0006_alter_reminder_create_todo_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="reminder",
            name="ios_notification",
            field=models.BooleanField(
                default=True,
                help_text="Show an iOS notification when this reminder triggers",
            ),
        ),
    ]
