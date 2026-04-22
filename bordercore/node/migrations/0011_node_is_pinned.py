from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("node", "0010_alter_nodetodo_unique_together_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="node",
            name="is_pinned",
            field=models.BooleanField(default=False),
        ),
    ]
